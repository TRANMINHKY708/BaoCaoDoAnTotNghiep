"""F09 ledger and atomic customer import; no ML endpoints or fallbacks."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.bulk import importer
from backend.bulk.upload import uploads
from backend.core.account_permissions import permitted
from backend.db.session import get_db
from backend.models.bulk import BulkImportJob, BulkImportRow
from backend.routers.bulk import SLOTS, acquire_slot, require_bulk
from backend.schemas.bulk_import import ImportRequest, JobDetail, JobList, JobSummary
from backend.services.account_admin import principal
from backend.services.versioned_models import failure

router = APIRouter(prefix="/api/v1/bulk/imports", tags=["Nhập hồ sơ khách hàng"])
REQUIRED = ["inference.csv.run", "customers.write", "snapshots.create"]
# K11: import history is read-only workspace data, so every role that reads customers can see it.
READ_REQUIRED = ["customers.read", "history.read"]


def require_import(request: Request):
    require_bulk(request)
    ctx = request.state.auth_context
    if not permitted(ctx["user"], REQUIRED):
        failure(
            403, "FORBIDDEN", "Tài khoản không có đủ quyền nhập khách hàng và snapshot."
        )
    return ctx


def require_reader(request: Request):
    ctx = getattr(request.state, "auth_context", None)
    if (
        request.app.state.settings.security_profile != "accounts"
        or not ctx
        or ctx.get("state") != "authenticated"
        or not ctx.get("user")
    ):
        failure(401, "UNAUTHORIZED", "Vui lòng đăng nhập để xem lịch sử nhập dữ liệu.")
    if not permitted(ctx["user"], READ_REQUIRED):
        failure(403, "FORBIDDEN", "Tài khoản không có quyền xem lịch sử nhập dữ liệu.")
    return ctx


def summary(job):
    return {
        "job_id": str(job.id),
        "idempotency_key": job.idempotency_key,
        "status": job.status,
        "counts": job.counts,
        "metadata": job.metadata_json,
        "created_at": job.created_at.isoformat(),
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "error_code": job.error_code,
        "error_row": job.error_row,
    }


@router.post("/confirm", response_model=JobSummary)
def confirm_import(
    payload: ImportRequest,
    request: Request,
    ctx: Annotated[dict, Depends(require_import)],
    db: Annotated[Session, Depends(get_db)],
):
    manifest = uploads.resolve_manifest(
        payload.manifest_reference, (str(ctx["user_id"]), str(ctx["id"]))
    )
    acquire_slot()
    try:
        job = importer.confirm(
            db,
            manifest,
            payload,
            ctx,
            lambda: principal(request.app.state.accounts, db, ctx, REQUIRED),
        )
        return summary(job)
    finally:
        SLOTS.release()


@router.get("", response_model=JobList)
def list_imports(
    ctx: Annotated[dict, Depends(require_reader)],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: str | None = Query(default=None, pattern=r"^[a-f0-9-]{36}$"),
):
    importer.ensure_schema(db)
    # 20 lần nhập gần nhất của workspace; tra theo khóa chống gửi trùng chỉ trả lần nhập của chính người hỏi.
    query = select(BulkImportJob)
    if idempotency_key:
        query = query.where(
            BulkImportJob.idempotency_key == idempotency_key,
            BulkImportJob.actor_user_id == ctx["user_id"],
        )
    jobs = db.scalars(
        query.order_by(BulkImportJob.created_at.desc(), BulkImportJob.id.desc()).limit(
            20
        )
    )
    return {"items": [summary(job) for job in jobs]}


@router.get("/{job_id}", response_model=JobDetail)
def import_detail(
    job_id: UUID,
    ctx: Annotated[dict, Depends(require_reader)],
    db: Annotated[Session, Depends(get_db)],
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
):
    importer.ensure_schema(db)
    job = db.scalar(select(BulkImportJob).where(BulkImportJob.id == job_id))
    if not job:
        failure(404, "BULK_JOB_NOT_FOUND", "Không tìm thấy lần nhập dữ liệu này.")
    total = db.scalar(
        select(func.count())
        .select_from(BulkImportRow)
        .where(BulkImportRow.job_id == job.id)
    )
    rows = db.scalars(
        select(BulkImportRow)
        .where(BulkImportRow.job_id == job.id)
        .order_by(BulkImportRow.row_number)
        .offset(offset)
        .limit(limit)
    )
    return {
        "job": summary(job),
        "total_rows": total,
        "offset": offset,
        "limit": limit,
        "rows": [
            {
                "row": row.row_number,
                "status": row.status,
                "customer_id": str(row.customer_id) if row.customer_id else None,
                "snapshot_id": str(row.snapshot_id) if row.snapshot_id else None,
                "outcome": row.outcome,
            }
            for row in rows
        ],
    }
