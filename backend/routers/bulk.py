"""CSV preparation: no repository, session, inference or export dependencies."""

from threading import BoundedSemaphore
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from backend.bulk.contract import MAX_BYTES
from backend.bulk.upload import uploads
from backend.core.account_permissions import permitted
from backend.schemas.bulk import (
    InspectionResponse,
    ManifestResponse,
    PrepareRequest,
    PreviewRequest,
    PreviewResponse,
)
from backend.services.versioned_models import failure

router = APIRouter(prefix="/api/v1/bulk/csv", tags=["Chuẩn bị nhập dữ liệu"])
SLOTS = BoundedSemaphore(2)


def acquire_slot():
    if not SLOTS.acquire(blocking=False):
        failure(429, "BULK_BUSY", "Đang xử lý các lô khác. Hãy thử lại sau.")


def require_bulk(request: Request):
    ctx = getattr(request.state, "auth_context", None)
    if (
        request.app.state.settings.security_profile != "accounts"
        or not ctx
        or ctx.get("state") != "authenticated"
        or not ctx.get("user")
    ):
        failure(401, "UNAUTHORIZED", "Vui lòng đăng nhập để chuẩn bị dữ liệu.")
    if not permitted(ctx["user"], ["inference.csv.run"]):
        failure(
            403,
            "FORBIDDEN",
            "Chỉ tài khoản vận hành hoặc quản trị được chuẩn bị dữ liệu.",
        )
    request.app.state.accounts.quotas.check(("bulk", str(ctx["user_id"])), 20)
    return str(ctx["user_id"]), str(ctx["id"])


@router.post("/inspect", response_model=InspectionResponse)
async def inspect_csv(
    owner: Annotated[tuple, Depends(require_bulk)],
    file: Annotated[UploadFile, File()],
    dataset_type: Annotated[Literal["behavior", "orders"], Form()],
):
    # Framework may spool multipart temporarily; close immediately, never retain a path.
    # Total request is also bounded by accounts middleware.
    try:
        acquire_slot()
    except Exception:
        await file.close()
        raise
    try:
        raw = await file.read(MAX_BYTES + 1)
        return uploads.inspect(raw, file.filename, dataset_type, owner)
    finally:
        try:
            await file.close()
        finally:
            SLOTS.release()


@router.post("/preview", response_model=PreviewResponse)
def preview_csv(
    payload: PreviewRequest, owner: Annotated[tuple, Depends(require_bulk)]
):
    acquire_slot()
    try:
        return uploads.preview(payload, owner)
    finally:
        SLOTS.release()


@router.post("/prepare-confirmation", response_model=ManifestResponse)
def prepare_confirmation(
    payload: PrepareRequest, owner: Annotated[tuple, Depends(require_bulk)]
):
    acquire_slot()
    try:
        return uploads.prepare(payload, owner)
    finally:
        SLOTS.release()
