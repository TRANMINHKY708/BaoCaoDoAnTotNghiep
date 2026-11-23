"""Synchronous F09 atomic business import. Never executes ML or Gemini."""

import hashlib
import json
from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

from backend.bulk.contract import VERSION
from backend.bulk.upload import digest
from backend.bulk.validation import validate_rows
from backend.models.analysis import F10_REVISION
from backend.models.bulk import (
    F09_REVISION,
    BulkImportJob,
    BulkImportRow,
    CustomerSourceIdentity,
)
from backend.models.customer import Customer, CustomerBehaviorSnapshot
from backend.schemas.v1 import BehaviorCreateV1
from backend.services.versioned_models import failure
from src.data.dataset_contract import FIELDS


def conflict(code, row=None):
    raise HTTPException(
        409,
        detail={
            "code": code,
            "message": "Lô có dữ liệu xung đột. Không ghi đè hồ sơ hoặc snapshot cũ.",
            "details": [{"row": row}] if row else [],
        },
    )


def ensure_schema(db):
    if (
        db.bind.dialect.name != "postgresql"
        or db.scalar(text("SELECT version_num FROM alembic_version")) not in {F09_REVISION, F10_REVISION}
    ):
        failure(
            503,
            "BULK_MIGRATION_REQUIRED",
            "Cần chạy migration F09 đã được kiểm chứng trước khi nhập dữ liệu.",
        )


def lock(db, key):
    number = int.from_bytes(
        hashlib.sha256(key.encode()).digest()[:8], "big", signed=True
    )
    db.execute(text("SELECT set_config('lock_timeout', '5s', true)"))
    db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": number})


def check_manifest(manifest, payload):
    actual = hashlib.sha256(
        json.dumps(manifest, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()
    if actual != payload.manifest_digest or manifest["contract_version"] != VERSION:
        conflict("BULK_MANIFEST_CHANGED")
    if datetime.now(UTC) >= datetime.fromisoformat(manifest["expires_at"]):
        failure(
            410,
            "BULK_REFERENCE_EXPIRED",
            "Bản chuẩn bị đã hết hạn. Không bắt đầu import mới.",
        )
    if manifest["dataset_type"] != "behavior":
        failure(
            409,
            "BULK_ORDERS_PREVIEW_ONLY",
            "Dữ liệu đơn hàng hiện chỉ hỗ trợ xem trước, chưa nhập hồ sơ hoặc tạo snapshot.",
        )
    if manifest["stats"]["error"] and not payload.accept_partial:
        failure(
            422, "BULK_CONFIRMATION_REQUIRED", "Cần xác nhận chỉ nhập các dòng hợp lệ."
        )
    if not manifest["rows"] or len(manifest["rows"]) != manifest["stats"]["valid"]:
        conflict("BULK_MANIFEST_CHANGED")
    excluded = manifest.get("excluded_rows", [])
    numbers = [r["row"] for r in manifest["rows"]] + [r["row"] for r in excluded]
    if (
        len(excluded) != manifest["stats"]["error"]
        or len(numbers) != manifest["stats"]["total"]
        or len(numbers) != len(set(numbers))
    ):
        conflict("BULK_MANIFEST_CHANGED")
    for row in manifest["rows"]:
        report = validate_rows(
            [row["data"]],
            dataset_type="behavior",
            as_of=datetime.fromisoformat(manifest["created_at"]),
            profile=manifest["profile"],
            models=tuple((m["task"], m["version"]) for m in manifest["models"]),
        )
        if (
            not report.valid
            or report.rows[0].snapshot_schema_compatible != row["snapshot_eligible"]
        ):
            conflict("BULK_MANIFEST_CHANGED", row["row"])
        value = report.rows[0].value
        expected_key = digest(
            [
                VERSION,
                "behavior",
                value.source,
                value.external_id,
                value.model_dump(mode="json")["captured_at"],
            ]
        )
        if row["row_key"] != expected_key or row["identity"] != {
            "source_system": value.source,
            "external_customer_id": value.external_id,
        }:
            conflict("BULK_MANIFEST_CHANGED", row["row"])


def apply_rows(db, job, manifest):
    identities = sorted(
        {
            (r["identity"]["source_system"], r["identity"]["external_customer_id"])
            for r in manifest["rows"]
        }
    )
    for source, external in identities:
        lock(db, "identity:" + digest([source, external]))
    created, updated, matched = set(), set(), set()
    snapshots_new = snapshots_skipped = snapshots_ineligible = 0
    for row in manifest["rows"]:
        source, external = (
            row["identity"]["source_system"],
            row["identity"]["external_customer_id"],
        )
        identity = db.scalar(
            select(CustomerSourceIdentity).where(
                CustomerSourceIdentity.source_system == source,
                CustomerSourceIdentity.external_customer_id == external,
            )
        )
        customer_action = "matched"
        if identity is None:
            internal = "bulk:" + digest([source, external])
            if db.scalar(select(Customer.id).where(Customer.external_id == internal)):
                conflict("BULK_IDENTITY_COLLISION", row["row"])
            customer = Customer(id=uuid4(), external_id=internal, is_active=True)
            db.add(customer)
            db.flush()
            db.add(
                CustomerSourceIdentity(
                    source_system=source,
                    external_customer_id=external,
                    customer_id=customer.id,
                )
            )
            db.flush()
            created.add(customer.id)
            customer_action = "created"
        else:
            customer = db.scalar(
                select(Customer)
                .where(Customer.id == identity.customer_id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if not customer or not customer.is_active:
                conflict("BULK_CUSTOMER_INACTIVE", row["row"])
            if customer.id not in created:
                matched.add(customer.id)
        content_hash = digest(row["data"])
        snapshot_id, applied_key = None, None
        snapshot_action = "not_eligible"
        if row["snapshot_eligible"]:
            previous = db.scalar(
                select(BulkImportRow).where(
                    BulkImportRow.snapshot_dedupe_key == row["row_key"]
                )
            )
            if previous:
                if (
                    previous.content_hash != content_hash
                    or previous.customer_id != customer.id
                ):
                    conflict("BULK_SNAPSHOT_CONFLICT", row["row"])
                snapshot_id = previous.snapshot_id
                snapshot_action = "reused"
                snapshots_skipped += 1
            else:
                values = {f.name: row["data"][f.name] for f in FIELDS}
                values.update(
                    Churned=bool(values["Churned"]),
                    captured_at=row["data"]["captured_at"],
                    source=source,
                )
                payload = BehaviorCreateV1.model_validate(values)
                candidates = list(
                    db.scalars(
                        select(CustomerBehaviorSnapshot)
                        .where(
                            CustomerBehaviorSnapshot.customer_id == customer.id,
                            CustomerBehaviorSnapshot.source == source,
                            CustomerBehaviorSnapshot.captured_at == payload.captured_at,
                        )
                        .limit(2)
                    )
                )
                if len(candidates) > 1:
                    conflict("BULK_HISTORICAL_DUPLICATES", row["row"])
                if candidates:
                    snapshot = candidates[0]
                    if any(
                        getattr(snapshot, f.column) != getattr(payload, f.column)
                        for f in FIELDS
                    ):
                        conflict("BULK_SNAPSHOT_CONFLICT", row["row"])
                    snapshot_action = "reused_existing"
                    snapshots_skipped += 1
                else:
                    snapshot = CustomerBehaviorSnapshot(
                        id=uuid4(),
                        customer_id=customer.id,
                        **payload.model_dump(by_alias=False),
                    )
                    db.add(snapshot)
                    db.flush()
                    snapshot_action = "created"
                    snapshots_new += 1
                    if customer.id not in created:
                        customer.updated_at = datetime.now(UTC)
                        updated.add(customer.id)
                        customer_action = "updated"
                snapshot_id, applied_key = snapshot.id, row["row_key"]
        else:
            snapshots_ineligible += 1
        db.add(
            BulkImportRow(
                job_id=job.id,
                row_number=row["row"],
                row_key=row["row_key"],
                snapshot_dedupe_key=applied_key,
                content_hash=content_hash,
                customer_id=customer.id,
                snapshot_id=snapshot_id,
                status="applied",
                outcome={
                    "identity": row["identity"],
                    "customer_action": customer_action,
                    "snapshot_action": snapshot_action,
                    "missing_features": row["missing_features"],
                    "input_data": row["data"],
                    "provenance": "source_declared_not_certified",
                },
            )
        )
        db.flush()  # Make same-customer later observations/dedupe visible in this tx.
    for row in manifest.get("excluded_rows", []):
        db.add(
            BulkImportRow(
                job_id=job.id,
                row_number=row["row"],
                status="excluded",
                outcome={"reason": row["status"], "codes": row["codes"]},
            )
        )
    return {
        **manifest["stats"],
        "customers_created": len(created),
        "customers_matched": len(matched),
        "customers_updated": len(updated),
        "snapshots_created": snapshots_new,
        "snapshots_skipped": snapshots_skipped,
        "snapshots_ineligible": snapshots_ineligible,
    }


def confirm(db, manifest, payload, context, authorize):
    """authorize rechecks/locks AUTH user+session before every ledger/business tx."""
    check_manifest(manifest, payload)
    ensure_schema(db)
    actor, session_id = UUID(str(context["user_id"])), UUID(str(context["id"]))
    authorize()
    lock(db, f"request:{actor}:{payload.idempotency_key}")
    job = db.scalar(
        select(BulkImportJob)
        .where(
            BulkImportJob.actor_user_id == actor,
            BulkImportJob.idempotency_key == payload.idempotency_key,
        )
        .with_for_update()
    )
    if job:
        if (
            job.actor_session_id != session_id
            or job.manifest_digest != payload.manifest_digest
            or job.metadata_json.get("request_hash") != digest(payload.model_dump())
        ):
            conflict("BULK_IDEMPOTENCY_CONFLICT")
        if job.status != "pending":
            return job
    else:
        job = BulkImportJob(
            id=uuid4(),
            actor_user_id=actor,
            actor_session_id=session_id,
            idempotency_key=payload.idempotency_key,
            manifest_digest=payload.manifest_digest,
            file_fingerprint=manifest["file_fingerprint"],
            status="pending",
            counts=manifest["stats"],
            metadata_json={
                "request_hash": digest(payload.model_dump()),
                "dataset_type": "behavior",
                "contract_version": VERSION,
                "filename": manifest["filename"],
                "sources": sorted(
                    {r["identity"]["source_system"] for r in manifest["rows"]}
                ),
                "mapping": manifest["mapping"],
                "profile": manifest["profile"],
                "accepted_partial": payload.accept_partial,
                "acknowledge_import": True,
            },
        )
        db.add(job)
        db.commit()  # Durable intent only; no customer/snapshot has been written.
    job_id = job.id
    try:
        authorize()
        lock(db, f"request:{actor}:{payload.idempotency_key}")
        job = db.scalar(
            select(BulkImportJob)
            .where(BulkImportJob.id == job_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if job.status != "pending":
            return job
        if datetime.now(UTC) >= datetime.fromisoformat(manifest["expires_at"]):
            failure(
                410,
                "BULK_REFERENCE_EXPIRED",
                "Bản chuẩn bị đã hết hạn trước khi bắt đầu ghi dữ liệu.",
            )
        job.counts = apply_rows(db, job, manifest)
        job.status = "completed"
        job.completed_at = datetime.now(UTC)
        db.commit()  # Customers, snapshots, row outcomes, job success and AUTH audit together.
        return job
    except (HTTPException, SQLAlchemyError) as exc:
        db.rollback()
        code = (
            exc.detail.get("code", "BULK_DATABASE_ERROR")
            if isinstance(exc, HTTPException) and isinstance(exc.detail, dict)
            else "BULK_DATABASE_ERROR"
        )
        row = (
            exc.detail.get("details", [{}])[0].get("row")
            if isinstance(exc, HTTPException)
            and isinstance(exc.detail, dict)
            and exc.detail.get("details")
            else None
        )
        try:
            authorize()
            lock(db, f"request:{actor}:{payload.idempotency_key}")
            failed = db.scalar(
                select(BulkImportJob)
                .where(BulkImportJob.id == job_id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            # A concurrent retry may have completed while this writer lost its lock.
            if failed.status == "pending":
                failed.status = "failed"
                failed.error_code = code
                failed.error_row = row
                failed.completed_at = datetime.now(UTC)
                db.commit()
            elif failed.status == "completed":
                return failed
        except Exception:  # noqa: BLE001 -- no fabricated FAILED when store/auth also fails
            db.rollback()
        if isinstance(exc, HTTPException):
            raise
        failure(
            503,
            "BULK_DATABASE_ERROR",
            "Chưa thể xác nhận kết quả ghi. Hãy kiểm tra job bằng mã yêu cầu; không tạo mã mới khi trạng thái chưa rõ.",
        )
