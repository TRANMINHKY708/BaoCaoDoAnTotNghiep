"""K13 Admin overview (accounts profile only). The /api/v1/admin/ prefix makes AccountsMiddleware require
`users.manage` (Admin) for every call; the service re-checks it inside its transaction."""

from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict

from backend.routers.admin_audit import AuditPerson
from backend.services.admin_overview import AdminOverviewService

router = APIRouter(prefix="/api/v1/admin/overview", tags=["Account administration"])


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RoleCounts(Strict):
    ADMIN: int
    OPERATOR: int
    VIEWER: int


class UserCounts(Strict):
    total: int
    active: int
    inactive: int
    by_role: RoleCounts
    locked: int
    must_change_password: int
    never_logged_in: int


class SessionCounts(Strict):
    active: int
    users_online: int


class RecentActivity(Strict):
    logins_succeeded: int
    logins_failed: int
    user_changes: int
    business_writes: int
    denied: int


class AttentionItem(Strict):
    user: AuditPerson
    reasons: list[Literal["locked", "must_change_password"]]
    locked_until: str | None


class OverviewEvent(Strict):
    id: str
    occurred_at: str
    event_code: str
    outcome: Literal["success", "denied", "failure"]
    actor: AuditPerson | None
    subject: AuditPerson | None


class AdminOverview(Strict):
    generated_at: str
    window_hours: int
    users: UserCounts
    sessions: SessionCounts
    last_24h: RecentActivity
    attention: list[AttentionItem]
    recent_admin_actions: list[OverviewEvent]
    recent_failed_logins: list[OverviewEvent]


@router.get("", response_model=AdminOverview, operation_id="k13_admin_overview")
def admin_overview(request: Request):
    """Read-only counts for Admins: users, live sessions, last 24 hours of security events, accounts needing attention."""
    return AdminOverviewService(request.app.state.accounts).read(request.state.auth_context)
