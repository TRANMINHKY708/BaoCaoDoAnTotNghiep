"""K8 audit log (accounts profile only). Kept out of admin.py, which holds exactly the six AUTH-01 operations.

The /api/v1/admin/ prefix makes AccountsMiddleware require `users.manage` (Admin) for every call.
"""

from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query, Request, Response
from pydantic import BaseModel, ConfigDict

from backend.services.admin_audit import AuditLogService, audit_query, export_query

router = APIRouter(prefix="/api/v1/admin/audit-events", tags=["Account administration"])


class AuditPerson(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    username: str
    display_name: str
    role: Literal["VIEWER", "OPERATOR", "ADMIN"]


class AuditEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    occurred_at: str
    event_code: str
    category: Literal["auth", "users", "business"]
    outcome: Literal["success", "denied", "failure"]
    actor: AuditPerson | None
    subject: AuditPerson | None
    resource_type: str | None
    resource_id: str | None
    request_id: str


class AuditPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[AuditEvent]
    limit: int
    next_cursor: str | None
    timezone: Literal["UTC", "Asia/Ho_Chi_Minh"]


XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get(
    "/export",
    response_class=Response,
    operation_id="k13_export_audit_events",
    responses={200: {"description": "Tệp Excel của nhật ký theo bộ lọc, mới nhất trước, tối đa 5.000 sự kiện",
                     "content": {XLSX: {"schema": {"type": "string", "format": "binary"}}}}},
)
def export_audit_events(
    request: Request,
    user_id: str | None = Query(None, description="Người thực hiện hoặc người bị tác động"),
    category: Literal["auth", "users", "business"] | None = None,
    outcome: Literal["success", "denied", "failure"] | None = None,
    date_from: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    date_to: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    timezone: Literal["UTC", "Asia/Ho_Chi_Minh"] = "UTC",
):
    """Same filters as the log, no paging. Read-only; no session ids, tokens, hashes or event details."""
    from backend.services.audit_export import workbook

    query = export_query(request.query_params)
    events, truncated, who = AuditLogService(request.app.state.accounts).export(request.state.auth_context, query)
    raw = workbook(events, query, truncated, who)
    stamp = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).strftime("%Y%m%d-%H%M%S")
    return Response(raw, media_type=XLSX, headers={
        "Content-Disposition": f'attachment; filename="MK-eAI-nhat-ky-hoat-dong-{stamp}.xlsx"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    })


@router.get("", response_model=AuditPage, operation_id="k8_list_audit_events")
def audit_events(
    request: Request,
    user_id: str | None = Query(None, description="Người thực hiện hoặc người bị tác động"),
    category: Literal["auth", "users", "business"] | None = None,
    outcome: Literal["success", "denied", "failure"] | None = None,
    date_from: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    date_to: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    timezone: Literal["UTC", "Asia/Ho_Chi_Minh"] = "UTC",
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = Query(None, max_length=200),
):
    """Read-only, newest first; keyset cursor on (occurred_at, id). No session ids, tokens or hashes."""
    return AuditLogService(request.app.state.accounts).read(
        request.state.auth_context, audit_query(request.query_params)
    )
