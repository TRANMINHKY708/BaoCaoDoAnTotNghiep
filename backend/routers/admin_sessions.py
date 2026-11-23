"""K13 active-session management (accounts profile only). The /api/v1/admin/ prefix makes AccountsMiddleware
require `users.manage` (Admin) and CSRF for the POST; the service re-checks Admin inside its transaction."""

from uuid import UUID

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, ConfigDict

from backend.routers.admin_audit import AuditPerson
from backend.routers.auth import payload
from backend.schemas.admin import Reauthenticate
from backend.services.accounts_service import AuthError
from backend.services.admin_sessions import AdminSessionService

router = APIRouter(prefix="/api/v1/admin/sessions", tags=["Account administration"])


class ActiveSession(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    user: AuditPerson
    created_at: str
    last_seen_at: str
    expires_at: str
    current: bool


class ActiveSessions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[ActiveSession]
    truncated: bool
    generated_at: str


@router.get("", response_model=ActiveSessions, operation_id="k13_list_sessions")
def list_sessions(request: Request):
    """Sessions that can still authenticate, most recently active first (at most 200). No tokens or CSRF values."""
    return AdminSessionService(request.app.state.accounts).read(request.state.auth_context)


@router.post(
    "/{session_id}/revoke",
    status_code=204,
    operation_id="k13_revoke_session",
    openapi_extra={"requestBody": {"required": True, "content": {"application/json": {
        "schema": Reauthenticate.model_json_schema()}}}},
)
def revoke_session(session_id: str, request: Request):
    """Close one session after the Admin re-enters their password; the user's other sessions are kept."""
    try:
        target = UUID(session_id)
    except ValueError:
        raise AuthError(422, "VALIDATION_ERROR") from None
    AdminSessionService(request.app.state.accounts).revoke(
        request.state.auth_context, target, payload(request, Reauthenticate), request.state.security_request_id
    )
    return Response(status_code=204)
