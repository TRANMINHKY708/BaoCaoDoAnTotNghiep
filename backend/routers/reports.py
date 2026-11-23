"""Explicit, read-only report exports. Preview and AI content are server referenced."""

from datetime import datetime
from threading import BoundedSemaphore
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from backend.core.account_permissions import permitted
from backend.db.session import get_db
from backend.schemas.reports import ReportRequest
from backend.schemas.v1 import ErrorEnvelope
from backend.services import report_data, report_renderers
from backend.services.versioned_models import failure

router = APIRouter(prefix="/api/v1/reports", tags=["Xuất báo cáo MK eAI"])
SLOTS = BoundedSemaphore(2)
MIME = {
    "pdf": "application/pdf",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def require_export(request: Request):
    ctx = getattr(request.state, "auth_context", None)
    if (
        request.app.state.settings.security_profile != "accounts"
        or not ctx
        or ctx.get("state") != "authenticated"
        or not ctx.get("user")
    ):
        failure(401, "UNAUTHORIZED", "Vui lòng đăng nhập để xuất báo cáo.")
    if not permitted(ctx["user"], ["models.read"]):
        failure(403, "FORBIDDEN", "Tài khoản không có quyền xuất báo cáo.")
    request.app.state.accounts.quotas.check(("reports", str(ctx["user_id"])), 10)
    return ctx


@router.post(
    "/export",
    response_class=Response,
    responses={
        200: {
            "description": "Báo cáo từ nguồn được xác minh, không lưu preview hoặc gọi Gemini",
            "content": {
                mime: {"schema": {"type": "string", "format": "binary"}}
                for mime in MIME.values()
            },
        },
        **{
            code: {"model": ErrorEnvelope}
            for code in (401, 403, 404, 409, 413, 422, 429, 503)
        },
    },
)
def export_report(
    payload: ReportRequest,
    ctx: Annotated[dict, Depends(require_export)],
    db: Annotated[Session, Depends(get_db)],
):
    if not SLOTS.acquire(blocking=False):
        failure(
            429, "REPORT_BUSY", "Đang có nhiều báo cáo được xuất. Vui lòng thử lại sau."
        )
    try:
        if payload.source == "churn_watchlist":
            from backend.services.churn_watchlist import watchlist_report

            document = watchlist_report(payload, ctx, db)
        else:
            document = (
                report_data.preview_report(payload, ctx)
                if payload.source == "preview"
                else report_data.customer_report(payload, ctx, db)
                if payload.source == "customer"
                else report_data.stored_report(payload, ctx, db)
            )
        raw = (
            report_renderers.pdf(document)
            if payload.format == "pdf"
            else report_renderers.xlsx(document)
        )
        if len(raw) > 10 * 1024 * 1024:
            failure(
                413, "REPORT_TOO_LARGE", "Báo cáo vượt 10 MiB. Hãy giảm phạm vi xuất."
            )
        slug = {
            "prediction": "du-doan",
            "segmentation": "phan-nhom",
            "what_if": "mo-phong",
            "customer": "ho-so-khach-hang",
            "churn_watchlist": "khach-hang-can-giu-chan",
        }[document["kind"]]
        filename = f"MK-eAI-{slug}-{datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')):%Y%m%d-%H%M%S}.{payload.format}"
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
