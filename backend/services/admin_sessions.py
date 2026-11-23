"""K13 active-session management for Admins (accounts profile).

List the sessions that can still authenticate and revoke one of them. Revoking follows the AUTH-01 admin
mutation order (advisory lock -> caller -> session -> audit -> commit) and the same re-authentication,
but only that session is closed: the user's security version, and so their other sessions, stay intact.
No session token, token hash or CSRF value is ever read into a response.
"""

from uuid import UUID

from sqlalchemy import select, text

from backend.core.passwords import verify_password
from backend.models.auth import AuthAuditEvent, AuthSession, User
from backend.services.account_admin import principal
from backend.services.accounts_service import AuthError
from backend.services.admin_audit import person
from backend.services.admin_overview import live_sessions

LIST_LIMIT = 200


def view(row, user, current_id):
    return {
        "id": str(row.id),
        "user": person(user),
        "created_at": row.created_at.isoformat(),
        "last_seen_at": row.last_seen_at.isoformat(),
        "expires_at": min(row.expires_at, row.idle_expires_at).isoformat(),
        "current": row.id == current_id,
    }


class AdminSessionService:
    def __init__(self, service):
        self.service = service

    def read(self, context):
        with self.service.transaction() as db:
            _, _, now = principal(self.service, db, context, ["users.manage"])
            rows = db.execute(
                select(AuthSession, User)
                .join(User, User.id == AuthSession.user_id)
                .where(live_sessions(now))
                .order_by(AuthSession.last_seen_at.desc(), AuthSession.id)
                .limit(LIST_LIMIT + 1)
            ).all()
            return {
                "items": [view(row, user, context["id"]) for row, user in rows[:LIST_LIMIT]],
                "truncated": len(rows) > LIST_LIMIT,
                "generated_at": now.isoformat(),
            }

    def revoke(self, context, session_id: UUID, payload, request_id):
        s = self.service
        with s.hashing():
            with s.sessions() as read:
                original = read.get(User, context["user_id"])
                if original is None:
                    raise AuthError(401, "UNAUTHORIZED", clear_cookie=True)
                encoded, version = original.password_hash, original.security_version
            verified = verify_password(encoded, payload.admin_password)
            failure = None
            with s.transaction() as db:
                db.execute(text("SELECT pg_advisory_xact_lock(1096111176, 1)"))
                actor, current, now = principal(s, db, context, ["users.manage"])
                if actor.password_hash != encoded or actor.security_version != version:
                    raise AuthError(401, "UNAUTHORIZED", clear_cookie=True)
                if not s.password_attempt(actor, now, verified):
                    s.audit(db, "user.updated", request_id, user=actor, session=current,
                            actor=True, outcome="denied")
                    failure = AuthError(403, "REAUTH_FAILED")
                else:
                    found = db.execute(
                        select(AuthSession, User)
                        .join(User, User.id == AuthSession.user_id)
                        .where(AuthSession.id == session_id, live_sessions(now))
                        .with_for_update(of=AuthSession)
                    ).first()
                    if found is None:
                        raise AuthError(404, "SESSION_NOT_FOUND")
                    target, owner = found
                    if target.id == current.id:
                        # Ending one's own session is a logout, not an admin action.
                        raise AuthError(409, "SELF_OPERATION_NOT_ALLOWED")
                    target.revoked_at, target.revoke_reason = now, "ADMIN_REVOKED"
                    db.add(AuthAuditEvent(
                        event_code="auth.sessions_revoked",
                        outcome="success",
                        actor_user_id=actor.id,
                        subject_user_id=owner.id,
                        session_id=current.id,
                        request_id=UUID(str(request_id)),
                        resource_type="users",
                        resource_id=owner.id,
                        details={"scope": "single_session"},
                    ))
            if failure:
                raise failure
