"""K13 Admin overview (accounts profile): counts of users, live sessions and recent security events.

Read-only, one transaction, Admin re-checked inside it like the K8 audit log. No password hashes,
session tokens, CSRF values or request bodies are read into the response.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, func, select
from sqlalchemy.orm import aliased

from backend.models.auth import AuthAuditEvent, AuthSession, User
from backend.services.account_admin import principal
from backend.services.admin_audit import CATEGORIES, person

WINDOW = timedelta(hours=24)
RECENT = 8
ATTENTION = 20


def event_row(event, actor, subject):
    return {
        "id": str(event.id),
        "occurred_at": event.occurred_at.isoformat(),
        "event_code": event.event_code,
        "outcome": event.outcome,
        "actor": person(actor),
        "subject": person(subject),
    }


def live_sessions(now):
    """Authenticated, not revoked, inside both expiries, and still matching the user's security version."""
    return and_(
        AuthSession.state == "authenticated",
        AuthSession.revoked_at.is_(None),
        AuthSession.expires_at > now,
        AuthSession.idle_expires_at > now,
        AuthSession.user_id == User.id,
        AuthSession.security_version == User.security_version,
        User.is_active.is_(True),
    )


class AdminOverviewService:
    def __init__(self, service):
        self.service = service

    def read(self, context, now=None):
        now = now or datetime.now(UTC)
        since = now - WINDOW
        with self.service.transaction() as db:
            principal(self.service, db, context, ["users.manage"])
            locked = and_(User.locked_until.is_not(None), User.locked_until > now)
            by_role = dict(db.execute(
                select(User.role, func.count()).where(User.is_active.is_(True)).group_by(User.role)
            ).all())
            totals = db.execute(select(
                func.count(),
                func.count().filter(User.is_active.is_(True)),
                func.count().filter(and_(User.is_active.is_(True), locked)),
                func.count().filter(and_(User.is_active.is_(True), User.must_change_password.is_(True))),
                func.count().filter(and_(User.is_active.is_(True), User.last_login_at.is_(None))),
            ).select_from(User)).one()
            sessions, online = db.execute(
                select(func.count(AuthSession.id), func.count(func.distinct(AuthSession.user_id)))
                .select_from(AuthSession).join(User, User.id == AuthSession.user_id).where(live_sessions(now))
            ).one()
            recent = AuthAuditEvent.occurred_at >= since
            logins = AuthAuditEvent.event_code == "auth.login"
            activity = db.execute(select(
                func.count().filter(and_(logins, AuthAuditEvent.outcome == "success")),
                func.count().filter(and_(logins, AuthAuditEvent.outcome != "success")),
                func.count().filter(AuthAuditEvent.event_code.startswith(CATEGORIES["users"])),
                func.count().filter(AuthAuditEvent.event_code.startswith(CATEGORIES["business"])),
                func.count().filter(AuthAuditEvent.outcome == "denied"),
            ).select_from(AuthAuditEvent).where(recent)).one()
            attention = db.execute(
                select(User, locked.label("locked"))
                .where(User.is_active.is_(True), (locked) | User.must_change_password.is_(True))
                .order_by(User.username)
                .limit(ATTENTION)
            ).all()
            actor, subject = aliased(User), aliased(User)

            def events(*where):
                return [
                    event_row(*row)
                    for row in db.execute(
                        select(AuthAuditEvent, actor, subject)
                        .outerjoin(actor, actor.id == AuthAuditEvent.actor_user_id)
                        .outerjoin(subject, subject.id == AuthAuditEvent.subject_user_id)
                        .where(*where)
                        .order_by(AuthAuditEvent.occurred_at.desc(), AuthAuditEvent.id.desc())
                        .limit(RECENT)
                    ).all()
                ]

            return {
                "generated_at": now.isoformat(),
                "window_hours": int(WINDOW.total_seconds() // 3600),
                "users": {
                    "total": totals[0],
                    "active": totals[1],
                    "inactive": totals[0] - totals[1],
                    "by_role": {role: by_role.get(role, 0) for role in ("ADMIN", "OPERATOR", "VIEWER")},
                    "locked": totals[2],
                    "must_change_password": totals[3],
                    "never_logged_in": totals[4],
                },
                "sessions": {"active": sessions, "users_online": online},
                "last_24h": {
                    "logins_succeeded": activity[0],
                    "logins_failed": activity[1],
                    "user_changes": activity[2],
                    "business_writes": activity[3],
                    "denied": activity[4],
                },
                "attention": [
                    {
                        "user": person(user),
                        "reasons": [r for r, flag in (("locked", is_locked), ("must_change_password",
                                                      user.must_change_password)) if flag],
                        "locked_until": user.locked_until.isoformat() if is_locked else None,
                    }
                    for user, is_locked in attention
                ],
                "recent_admin_actions": events(AuthAuditEvent.event_code.startswith(CATEGORIES["users"])),
                "recent_failed_logins": events(
                    AuthAuditEvent.event_code == "auth.login", AuthAuditEvent.outcome != "success"
                ),
            }
