"""Bounded F10 steps: durable PostgreSQL checkpoints, session-scoped RAM previews.

No worker credentials, hidden retries or model-policy bypass. The browser advances
one transaction at a time; closing it pauses, reopening explicitly resumes.
"""

import hashlib
import time
from collections import Counter, OrderedDict
from copy import deepcopy
from datetime import UTC, datetime
from threading import RLock

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import func, inspect, select, text

from backend.bulk.importer import lock
from backend.bulk.inference import infer_batch
from backend.models.analysis import F10_REVISION, F10_TABLES
from backend.models.analysis import BulkAnalysisItem as Item
from backend.models.analysis import BulkAnalysisJob as Job
from backend.models.bulk import BulkImportJob, BulkImportRow
from backend.models.customer import Customer, CustomerBehaviorSnapshot
from backend.models.prediction import PredictionResult, SegmentationResult
from backend.services.accounts_service import AuthError
from backend.services.persistence_service import persist_inference_results
from backend.services.versioned_models import (
    INPUT_MODELS,
    ensure_persistence_allowed,
    failure,
    verify_pin,
    versioned_models,
)
from src.data.dataset_contract import FIELDS

CHUNK_SIZE = 50


class PreviewCache:
    """Bounded per-process cache; never persisted and never shared across sessions."""

    def __init__(self):
        self.data = OrderedDict()
        self.lock = RLock()

    def update(self, owner, job_id, results):
        with self.lock:
            key = (*map(str, owner), str(job_id))
            old = self.get(owner, job_id)
            old.update(results)
            self.data[key] = (time.monotonic() + 900, old)
            self.data.move_to_end(key)
            while len(self.data) > 20:
                self.data.popitem(last=False)

    def get(self, owner, job_id):
        with self.lock:
            now = time.monotonic()
            for key in list(self.data):
                if self.data[key][0] <= now:
                    del self.data[key]
            value = self.data.get((*map(str, owner), str(job_id)))
            return deepcopy(value[1]) if value else {}

    def clear(self, owner, job_id):
        with self.lock:
            self.data.pop((*map(str, owner), str(job_id)), None)


previews = PreviewCache()


def digest(*parts):
    return hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()


def ensure_schema(db):
    if (
        db.bind.dialect.name != "postgresql"
        or db.scalar(text("SELECT version_num FROM alembic_version")) != F10_REVISION
    ):
        failure(
            503,
            "ANALYSIS_MIGRATION_REQUIRED",
            "Cần chạy migration F10 trước khi phân tích hàng loạt.",
        )
    if not F10_TABLES.issubset(inspect(db.connection()).get_table_names()):
        failure(503, "ANALYSIS_MIGRATION_REQUIRED", "Schema F10 chưa đầy đủ.")


def owned(db, job_id, ctx, *, write=False):
    ensure_schema(db)
    query = select(Job).where(Job.id == job_id, Job.actor_user_id == ctx["user_id"])
    job = db.scalar(
        query.with_for_update().execution_options(populate_existing=True)
        if write
        else query
    )
    if job is None:
        failure(404, "ANALYSIS_NOT_FOUND", "Không tìm thấy tác vụ thuộc tài khoản này.")
    return job


def visible(db, job_id):
    """Read-only lookup in the shared workspace (K11); advancing or retrying still uses owned()."""
    ensure_schema(db)
    job = db.scalar(select(Job).where(Job.id == job_id))
    if job is None:
        failure(404, "ANALYSIS_NOT_FOUND", "Không tìm thấy tác vụ phân tích này.")
    return job


def counts(db, job):
    db.flush()
    grouped = dict(
        db.execute(
            select(Item.status, func.count())
            .where(Item.job_id == job.id)
            .group_by(Item.status)
        ).all()
    )
    job.counts = {
        **job.counts,
        "total": sum(grouped.values()),
        **{
            name: grouped.get(name, 0)
            for name in ("queued", "success", "skipped", "failed")
        },
    }


def create(db, payload, ctx, authorize):
    ensure_schema(db)
    state = ensure_persistence_allowed(
        payload.task, payload.model_version, payload.save_results
    )
    verify_pin(state)
    authorize()
    source = db.scalar(
        select(BulkImportJob).where(
            BulkImportJob.id == payload.import_job_id,
            BulkImportJob.actor_user_id == ctx["user_id"],
        )
    )
    if source is None or source.status != "completed":
        failure(
            409,
            "IMPORT_NOT_COMPLETED",
            "Chọn một lô đã nhập hoàn tất của tài khoản hiện tại.",
        )
    key = digest(
        ctx["user_id"],
        source.id,
        payload.task,
        payload.model_version,
        state["artifact_sha256"],
        state["metadata_sha256"],
        payload.save_results,
    )
    lock(db, "f10-plan:" + key)
    previous = db.scalar(select(Job).where(Job.plan_key == key))
    if previous:
        return previous
    rows = db.execute(
        select(BulkImportRow.customer_id, BulkImportRow.snapshot_id).where(
            BulkImportRow.job_id == source.id, BulkImportRow.status == "applied"
        )
    ).all()
    links = {(r.customer_id, r.snapshot_id) for r in rows if r.snapshot_id is not None}
    if not links or len(links) > 1000:
        failure(
            422,
            "ANALYSIS_NO_ELIGIBLE_SNAPSHOTS",
            "Lô phải có từ 1 đến 1.000 snapshot đã nhập; không tự tạo snapshot thiếu.",
        )
    job = Job(
        import_job_id=source.id,
        actor_user_id=ctx["user_id"],
        plan_key=key,
        task=payload.task,
        model_version=payload.model_version,
        artifact_sha256=state["artifact_sha256"],
        metadata_sha256=state["metadata_sha256"],
        persist_results=payload.save_results,
        counts={
            "source_rows_without_snapshot": sum(r.snapshot_id is None for r in rows),
            "saved_new": 0,
            "saved_reused": 0,
        },
    )
    db.add(job)
    db.flush()
    db.add_all(
        Item(job_id=job.id, customer_id=c, snapshot_id=s)
        for c, s in sorted(links, key=lambda r: str(r[1]))
    )
    counts(db, job)
    authorize()
    db.commit()
    return job


def advance(db, job_id, ctx, authorize):
    job = owned(db, job_id, ctx, write=True)
    if job.status in {"completed", "failed"}:
        return job
    try:
        authorize()
        state = versioned_models.get(job.task, job.model_version)
        if any(
            state[k] != getattr(job, k) for k in ("artifact_sha256", "metadata_sha256")
        ):
            failure(
                409,
                "ANALYSIS_MODEL_CHANGED",
                "Danh tính mô hình đã thay đổi; không tiếp tục tác vụ cũ.",
            )
        verify_pin(state)
        ensure_persistence_allowed(job.task, job.model_version, job.persist_results)
        # Across import jobs too: all commits for the same pinned model serialize.
        lock(
            db, "f10-model:" + digest(job.task, job.model_version, job.artifact_sha256)
        )
        job.status = "running"
        job.started_at = job.started_at or datetime.now(UTC)
        items = list(
            db.scalars(
                select(Item)
                .where(Item.job_id == job.id, Item.status == "queued")
                .order_by(Item.snapshot_id)
                .limit(CHUNK_SIZE)
            )
        )
        snapshots = {
            s.id: s
            for s in db.scalars(
                select(CustomerBehaviorSnapshot)
                .where(CustomerBehaviorSnapshot.id.in_([i.snapshot_id for i in items]))
                .with_for_update(read=True)
            )
        }
        active = set(
            db.scalars(
                select(Customer.id)
                .where(
                    Customer.id.in_([i.customer_id for i in items]),
                    Customer.is_active.is_(True),
                )
                .with_for_update(read=True)
            )
        )
        ready, inputs, keys = [], [], []
        schema = INPUT_MODELS[(job.task, job.model_version)]
        for item in items:
            snapshot = snapshots.get(item.snapshot_id)
            if snapshot is None or snapshot.customer_id != item.customer_id:
                failure(
                    409,
                    "ANALYSIS_LINK_MISMATCH",
                    "Liên kết hồ sơ/snapshot không còn hợp lệ.",
                )
            if item.customer_id not in active:
                item.status, item.error_code = "skipped", "CUSTOMER_INACTIVE"
                continue
            key = digest(
                job.task,
                job.model_version,
                job.artifact_sha256,
                job.metadata_sha256,
                item.snapshot_id,
            )
            keys.append(key)
            ready.append(item)
            raw = {
                f.name: getattr(snapshot, f.column)
                for f in FIELDS
                if f.name in schema.model_fields
            }
            # Stored bool churn is an exact 0/1 feature, never an inferred default.
            if "Churned" in raw:
                raw["Churned"] = float(raw["Churned"])
            try:
                inputs.append(schema.model_validate(raw).model_dump())
            except ValidationError:
                ready.pop()
                keys.pop()
                item.status, item.error_code = "failed", "INVALID_SNAPSHOT_INPUT"
        canonical = (
            {
                i.dedupe_key: i
                for i in db.scalars(select(Item).where(Item.dedupe_key.in_(keys)))
            }
            if job.persist_results
            else {}
        )
        fresh, fresh_inputs, fresh_keys = [], [], []
        for item, values, key in zip(ready, inputs, keys):
            previous = canonical.get(key)
            if previous:
                item.prediction_result_id = previous.prediction_result_id
                item.segmentation_result_id = previous.segmentation_result_id
                item.status = "success"
                job.counts = {
                    **job.counts,
                    "saved_reused": job.counts["saved_reused"] + 1,
                }
            else:
                fresh.append(item)
                fresh_inputs.append(values)
                fresh_keys.append(key)
        pending_preview = {}
        if fresh:
            validated, results = infer_batch(
                job.task, job.model_version, fresh_inputs, state
            )
            if job.persist_results:
                run_id = persist_inference_results(
                    db,
                    task=job.task,
                    run_type="batch",
                    inputs=validated,
                    results=results,
                    customer_ids=[i.customer_id for i in fresh],
                    snapshot_ids=[i.snapshot_id for i in fresh],
                    source=f"f10:{job.id}",
                    commit=False,
                )
                model = (
                    PredictionResult
                    if job.task == "classification"
                    else SegmentationResult
                )
                saved = {
                    r.behavior_snapshot_id: r.id
                    for r in db.scalars(select(model).where(model.run_id == run_id))
                }
                for item, key in zip(fresh, fresh_keys):
                    setattr(
                        item,
                        "prediction_result_id"
                        if job.task == "classification"
                        else "segmentation_result_id",
                        saved[item.snapshot_id],
                    )
                    item.dedupe_key = key
                job.counts = {
                    **job.counts,
                    "saved_new": job.counts["saved_new"] + len(fresh),
                }
            else:
                pending_preview = {
                    str(i.snapshot_id): result for i, result in zip(fresh, results)
                }
            for item in fresh:
                item.status, item.error_code = "success", None
        counts(db, job)
        if job.counts["queued"] == 0:
            job.status, job.completed_at = "completed", datetime.now(UTC)
        authorize()
        db.commit()
        if pending_preview:
            previews.update((ctx["user_id"], ctx["id"]), job.id, pending_preview)
        return job
    except Exception as exc:
        db.rollback()
        # No raw exception text, features, credentials or outputs in failure metadata.
        if (
            isinstance(exc, AuthError)
            or isinstance(exc, HTTPException)
            and exc.status_code in {401, 403}
        ):
            raise
        failed = owned(db, job_id, ctx, write=True)
        failed.status, failed.error_code = "failed", "ANALYSIS_STEP_FAILED"
        if isinstance(exc, HTTPException) and isinstance(exc.detail, dict):
            failed.error_code = exc.detail.get("code", failed.error_code)
        authorize()
        db.commit()
        return failed


def retry(db, job_id, ctx, authorize):
    job = owned(db, job_id, ctx, write=True)
    authorize()
    # Saved successes are immutable; preview recomputation is explicit and never saved.
    query = select(Item).where(Item.job_id == job.id)
    if job.persist_results:
        query = query.where(Item.status == "failed")
    for item in db.scalars(query):
        item.status, item.error_code = "queued", None
    job.status, job.error_code, job.completed_at = "queued", None, None
    job.attempts += 1
    counts(db, job)
    db.commit()
    previews.clear((ctx["user_id"], ctx["id"]), job.id)
    return job


def summary(job):
    return {
        "job_id": str(job.id),
        "import_job_id": str(job.import_job_id),
        "task": job.task,
        "model_version": job.model_version,
        "artifact_sha256": job.artifact_sha256,
        "metadata_sha256": job.metadata_sha256,
        "persist_results": job.persist_results,
        "status": job.status,
        "counts": job.counts,
        "attempts": job.attempts,
        "error_code": job.error_code,
        **{
            k: getattr(job, k).isoformat() if getattr(job, k) else None
            for k in ("created_at", "started_at", "completed_at")
        },
    }


def detail(db, job, ctx, offset=0, limit=50):
    items = list(
        db.scalars(select(Item).where(Item.job_id == job.id).order_by(Item.snapshot_id))
    )
    references = {}
    for row in db.scalars(
        select(BulkImportRow).where(BulkImportRow.job_id == job.import_job_id)
    ):
        identity = row.outcome.get("identity", {})
        if row.snapshot_id and identity.get("external_customer_id"):
            references[row.snapshot_id] = (
                f"{identity.get('source_system', '')} / {identity['external_customer_id']}"
            )
    results = (
        previews.get((ctx["user_id"], ctx["id"]), job.id)
        if not job.persist_results
        else {}
    )
    if job.persist_results:
        model = PredictionResult if job.task == "classification" else SegmentationResult
        ids = [
            getattr(
                i,
                "prediction_result_id"
                if job.task == "classification"
                else "segmentation_result_id",
            )
            for i in items
        ]
        stored = {
            r.id: r
            for r in db.scalars(
                select(model).where(model.id.in_([v for v in ids if v]))
            )
        }
        for item, rid in zip(items, ids):
            r = stored.get(rid)
            if r:
                results[str(item.snapshot_id)] = (
                    {
                        "result_id": str(r.id),
                        "run_id": str(r.run_id),
                        "model_version": job.model_version,
                        "purchase_level": r.purchase_level,
                        "probabilities": {
                            "Low": r.probability_low,
                            "Medium": r.probability_medium,
                            "High": r.probability_high,
                        },
                    }
                    if job.task == "classification"
                    else {
                        "result_id": str(r.id),
                        "run_id": str(r.run_id),
                        "model_version": job.model_version,
                        "cluster": r.cluster,
                        "segment_name": r.segment_name,
                        "distance_to_centroid": r.distance_to_centroid,
                    }
                )
    distribution = Counter(
        str(r["purchase_level"] if job.task == "classification" else r["cluster"])
        for r in results.values()
    )
    return {
        "job": summary(job),
        "offset": offset,
        "limit": limit,
        "preview_available": len(results),
        "distribution": dict(distribution),
        "rows": [
            {
                "customer_id": str(i.customer_id),
                "customer_reference": references.get(
                    i.snapshot_id, f"KH-{str(i.customer_id)[:8].upper()}"
                ),
                "snapshot_id": str(i.snapshot_id),
                "status": i.status,
                "error_code": i.error_code,
                "saved": bool(i.prediction_result_id or i.segmentation_result_id),
                "result": results.get(str(i.snapshot_id)),
            }
            for i in items[offset : offset + limit]
        ],
    }
