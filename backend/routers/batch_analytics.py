"""Approved F11 shared-workspace read APIs; no changes to F09/F10 write rights."""

from datetime import datetime
from typing import Annotated
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import ValidationError
from sqlalchemy.engine import Connection

from backend.bulk import analytics, analytics_narrative, analytics_report
from backend.bulk.insights import evaluate
from backend.core.account_permissions import permitted
from backend.routers.reports import MIME, SLOTS
from backend.schemas.batch_analytics import (
    BatchAction,
    BatchExport,
    BatchFilters,
    BatchNarrative,
    BatchOptions,
    BatchQuery,
    BatchView,
)
from backend.schemas.insights import InsightEnvelope, InsightQuery
from backend.schemas.v1 import ErrorEnvelope
from backend.services import report_renderers
from backend.services.dashboard import get_dashboard_connection
from backend.services.versioned_models import failure

router = APIRouter(
    prefix="/api/v1/bulk/analytics",
    tags=["Dashboard phân tích hàng loạt"],
    responses={
        code: {"model": ErrorEnvelope} for code in (401, 403, 409, 413, 422, 429, 503)
    },
)
REQUIRED = ["history.read", "customers.read", "models.read"]


def require_analytics(request: Request):
    ctx = getattr(request.state, "auth_context", None)
    if (
        request.app.state.settings.security_profile != "accounts"
        or not ctx
        or ctx.get("state") != "authenticated"
    ):
        failure(
            401, "UNAUTHORIZED", "Vui lòng đăng nhập để xem dashboard chung workspace."
        )
    if not ctx.get("user") or not permitted(ctx["user"], REQUIRED):
        failure(
            403, "FORBIDDEN", "Tài khoản không có đủ quyền đọc phân tích khách hàng."
        )
    return ctx


@router.get("/options", response_model=BatchOptions)
def options(
    ctx: Annotated[dict, Depends(require_analytics)],
    conn: Annotated[Connection, Depends(get_dashboard_connection)],
    import_job_id: UUID | None = None,
):
    return analytics.options(conn, import_job_id)


@router.get("/overview", response_model=BatchView)
def overview(
    query: Annotated[BatchQuery, Query()],
    ctx: Annotated[dict, Depends(require_analytics)],
    conn: Annotated[Connection, Depends(get_dashboard_connection)],
):
    filters = BatchFilters.model_validate(query.model_dump(exclude={"offset", "limit"}))
    return analytics.view(conn, filters, query.offset, query.limit)


@router.get("/insights", response_model=InsightEnvelope)
def insights(
    query: Annotated[InsightQuery, Query()],
    request: Request,
    response: Response,
    ctx: Annotated[dict, Depends(require_analytics)],
    conn: Annotated[Connection, Depends(get_dashboard_connection)],
):
    filters = BatchFilters.model_validate(
        query.model_dump(exclude={"expected_fingerprint", "feature_key"})
    )
    response.headers["Cache-Control"] = "no-store"
    if len(request.query_params) != len(request.query_params.multi_items()):
        failure(422, "VALIDATION_ERROR", "Không lặp tham số truy vấn.")
    try:
        data = analytics.view(conn, filters, limit=1)
        analytics.check_fingerprint(data, query.expected_fingerprint)
        return evaluate(data, query.feature_key)
    except (ValidationError, KeyError, TypeError):
        failure(
            503,
            "BATCH_INSIGHT_SOURCE_INVALID",
            "Chưa thể xác minh cấu trúc số liệu nguồn.",
        )
    except HTTPException as exc:
        exc.headers = {**(exc.headers or {}), "Cache-Control": "no-store"}
        raise


@router.post(
    "/export",
    response_class=Response,
    responses={
        200: {
            "content": {
                mime: {"schema": {"type": "string", "format": "binary"}}
                for mime in MIME.values()
            }
        }
    },
)
def export(
    payload: BatchExport,
    request: Request,
    ctx: Annotated[dict, Depends(require_analytics)],
    conn: Annotated[Connection, Depends(get_dashboard_connection)],
):
    request.app.state.accounts.quotas.check(("reports", str(ctx["user_id"])), 10)
    if not SLOTS.acquire(blocking=False):
        failure(
            429, "REPORT_BUSY", "Đang có nhiều báo cáo được xuất. Vui lòng thử lại sau."
        )
    try:
        data = analytics.view(conn, payload.filters, export=True)
        analytics.check_fingerprint(data, payload.fingerprint)
        conn.rollback()  # Release the snapshot before PDF rendering; all facts are already captured.
        document = analytics_report.document(data)
        raw = (
            report_renderers.pdf(document)
            if payload.format == "pdf"
            else report_renderers.xlsx(document)
        )
        if len(raw) > 10 * 1024 * 1024:
            failure(413, "REPORT_TOO_LARGE", "Báo cáo vượt 10 MiB. Hãy thu hẹp bộ lọc.")
        filename = f"MK-eAI-phan-tich-lo-{datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')):%Y%m%d-%H%M%S}.{payload.format}"
        return Response(
            raw,
            media_type=MIME[payload.format],
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
            },
        )
    finally:
        SLOTS.release()


@router.post("/narrative", response_model=BatchNarrative)
def narrative(
    payload: BatchAction,
    request: Request,
    ctx: Annotated[dict, Depends(require_analytics)],
    conn: Annotated[Connection, Depends(get_dashboard_connection)],
):
    request.app.state.accounts.quotas.check(("batch-narrative", str(ctx["user_id"])), 5)
    data = analytics.view(conn, payload.filters, limit=1)
    analytics.check_fingerprint(data, payload.fingerprint)
    conn.rollback()
    return analytics_narrative.generate(data)
