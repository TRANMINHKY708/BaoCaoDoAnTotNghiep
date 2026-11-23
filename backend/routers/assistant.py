"""Accounts-only, stateless assistant; existing session/CSRF checks still apply."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from backend.core.account_permissions import permitted
from backend.db.session import get_db
from backend.schemas.assistant import ChatRequest, ChatResponse
from backend.schemas.narrative import NarrativeRequest, NarrativeResponse
from backend.schemas.v1 import ErrorEnvelope
from backend.services.assistant import chat
from backend.services.assistant_tools import ReadTools
from backend.services.versioned_models import failure

router = APIRouter(prefix="/api/v1/assistant", tags=["Trợ lý MK eAI"])


def require_account(request: Request):
    ctx = getattr(request.state, "auth_context", None)
    if (
        request.app.state.settings.security_profile != "accounts"
        or not ctx
        or ctx.get("state") != "authenticated"
        or not ctx.get("user")
    ):
        failure(401, "UNAUTHORIZED", "Vui lòng đăng nhập tài khoản để sử dụng trợ lý.")
    if not permitted(ctx["user"], ["models.read"]):
        failure(403, "FORBIDDEN", "Tài khoản chưa có quyền sử dụng trợ lý.")
    request.app.state.accounts.quotas.check(("assistant", str(ctx["user_id"])), 5)
    return ctx["user"]


@router.post(
    "/chat",
    response_model=ChatResponse,
    responses={
        code: {"model": ErrorEnvelope} for code in (401, 403, 422, 429, 502, 503, 504)
    },
)
def assistant_chat(
    payload: ChatRequest,
    user: Annotated[dict, Depends(require_account)],
    db: Annotated[Session, Depends(get_db)],
):
    """Không lưu hội thoại. Giới hạn 5 yêu cầu/phút/người/process; chỉ đọc workspace chung.

    Cần session accounts và CSRF/Origin hợp lệ. customer_id giới hạn phạm vi công cụ,
    không biểu thị ownership. Lịch sử do client gửi chưa được xác minh.
    """
    return chat(payload, ReadTools(db, user, payload.customer_id))


@router.post(
    "/narrative",
    response_model=NarrativeResponse,
    responses={
        code: {"model": ErrorEnvelope}
        for code in (401, 403, 409, 422, 429, 502, 503, 504)
    },
)
def narrative(
    payload: NarrativeRequest,
    request: Request,
    user: Annotated[dict, Depends(require_account)],
):
    """Nhận xét kết quả backend được tham chiếu trong cùng phiên, không lưu DB."""
    from backend.services.narratives import generate

    return generate(request.state.auth_context, payload.receipt)
