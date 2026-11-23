"""Chunked batch analysis: only writers create, advance or retry jobs; every role reads history (K11)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.bulk import analysis
from backend.core.account_permissions import permitted
from backend.db.session import get_db
from backend.models.analysis import BulkAnalysisJob
from backend.schemas.analysis import (
    AnalysisDetail,
    AnalysisList,
    AnalysisRequest,
    AnalysisSummary,
)
from backend.services.account_admin import principal
from backend.services.versioned_models import failure

router = APIRouter(prefix="/api/v1/bulk/analyses", tags=["Phân tích hàng loạt"])
REQUIRED = ["inference.csv.run", "inference.json.run", "history.read"]
# K11: reading analysis jobs and their stored results is read-only workspace data.
READ_REQUIRED = ["customers.read", "history.read"]


def require_analysis(request: Request):
    ctx = getattr(request.state, "auth_context", None)
    if (
        request.app.state.settings.security_profile != "accounts"
        or not ctx
        or ctx.get("state") != "authenticated"
    ):
        failure(401, "UNAUTHORIZED", "Vui lòng đăng nhập để phân tích hàng loạt.")
    if not permitted(ctx["user"], REQUIRED):
        failure(
            403,
            "FORBIDDEN",
            "Chỉ tài khoản vận hành hoặc quản trị được phân tích hàng loạt.",
        )
    return ctx


def require_reader(request: Request):
    ctx = getattr(request.state, "auth_context", None)
    if (
        request.app.state.settings.security_profile != "accounts"
        or not ctx
        or ctx.get("state") != "authenticated"
    ):
        failure(401, "UNAUTHORIZED", "Vui lòng đăng nhập để xem phân tích hàng loạt.")
    if not permitted(ctx["user"], READ_REQUIRED):
        failure(403, "FORBIDDEN", "Tài khoản không có quyền xem phân tích hàng loạt.")
    return ctx


def authorization(request, db, ctx, save=False):
    return lambda: principal(
        request.app.state.accounts,
        db,
        ctx,
        REQUIRED + (["analysis.legacy.save"] if save else []),
    )


@router.post("", response_model=AnalysisSummary)
def create_analysis(
    payload: AnalysisRequest,
    request: Request,
    ctx: Annotated[dict, Depends(require_analysis)],
    db: Annotated[Session, Depends(get_db)],
):
    request.app.state.accounts.quotas.check(
        ("analysis-create", str(ctx["user_id"])), 10
    )
    return analysis.summary(
        analysis.create(
            db, payload, ctx, authorization(request, db, ctx, payload.save_results)
        )
    )


@router.get("", response_model=AnalysisList)
def list_analyses(
    ctx: Annotated[dict, Depends(require_reader)],
    db: Annotated[Session, Depends(get_db)],
    import_job_id: UUID,
):
    analysis.ensure_schema(db)
    jobs = db.scalars(
        select(BulkAnalysisJob)
        .where(
            BulkAnalysisJob.import_job_id == import_job_id,
        )
        .order_by(BulkAnalysisJob.created_at.desc())
        .limit(20)
    )
    return {"items": [analysis.summary(job) for job in jobs]}


@router.get("/{job_id}", response_model=AnalysisDetail)
def analysis_detail(
    job_id: UUID,
    ctx: Annotated[dict, Depends(require_reader)],
    db: Annotated[Session, Depends(get_db)],
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    # Kết quả đã lưu xem được trong cả workspace; bản xem trước không lưu chỉ hiện trong phiên đã chạy.
    return analysis.detail(db, analysis.visible(db, job_id), ctx, offset, limit)


@router.post("/{job_id}/advance", response_model=AnalysisSummary)
def advance_analysis(
    job_id: UUID,
    request: Request,
    ctx: Annotated[dict, Depends(require_analysis)],
    db: Annotated[Session, Depends(get_db)],
):
    job = analysis.owned(db, job_id, ctx)
    return analysis.summary(
        analysis.advance(
            db, job_id, ctx, authorization(request, db, ctx, job.persist_results)
        )
    )


@router.post("/{job_id}/retry", response_model=AnalysisSummary)
def retry_analysis(
    job_id: UUID,
    request: Request,
    ctx: Annotated[dict, Depends(require_analysis)],
    db: Annotated[Session, Depends(get_db)],
):
    job = analysis.owned(db, job_id, ctx)
    return analysis.summary(
        analysis.retry(
            db, job_id, ctx, authorization(request, db, ctx, job.persist_results)
        )
    )
