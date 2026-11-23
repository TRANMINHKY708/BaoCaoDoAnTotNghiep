"""Admin mutations: advisory -> UUID-sorted users -> session -> audit -> commit."""

import hashlib
import json
import re
from uuid import UUID

from sqlalchemy import and_, func, or_, select, text, update
from sqlalchemy.exc import IntegrityError
from backend.core.passwords import hash_password, verify_password
from backend.models.auth import AuthSession, User
from backend.services.accounts_service import AuthError


def etag(user):
    value = json.dumps(user, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return '"au1-' + hashlib.sha256(value.encode()).hexdigest() + '"'


def conditional(value):
    if value is None:
        raise AuthError(428, "PRECONDITION_REQUIRED")
    if not re.fullmatch(r'"au1-[a-f0-9]{64}"', value):
        raise AuthError(400, "INVALID_IF_MATCH")


def principal(service, db, context, required=()):
    """Caller user lock must precede session/business locks and survive commit."""
    from backend.core.account_permissions import permitted

    user = db.scalar(
        select(User)
        .where(User.id == context["user_id"])
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    row = db.scalar(
        select(AuthSession)
        .where(AuthSession.id == context["id"])
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    now = service.now(db)
    if (
        not user
        or not row
        or not user.is_active
        or row.revoked_at is not None
        or row.security_version != user.security_version
        or user.security_version != context["security_version"]
        or now >= min(row.expires_at, row.idle_expires_at)
    ):
        raise AuthError(401, "UNAUTHORIZED", clear_cookie=True)
    if user.must_change_password:
        raise AuthError(403, "PASSWORD_CHANGE_REQUIRED")
    if not permitted(service.user_view(user, now), required):
        raise AuthError(403, "FORBIDDEN")
    return user, row, now


def admin_query(query):
    allowed = {"q", "role", "status", "sort", "direction", "limit", "offset"}
    if set(query) - allowed or any(len(query.getlist(k)) != 1 for k in query):
        raise AuthError(422, "VALIDATION_ERROR")
    q = query.get("q")
    if q is not None:
        q = q.strip()
        if not 1 <= len(q) <= 100:
            raise AuthError(422, "VALIDATION_ERROR")
    values = {
        "q": q,
        "role": query.get("role"),
        "status": query.get("status"),
        "sort": query.get("sort", "created_at"),
        "direction": query.get("direction", "desc"),
    }
    if (
        values["role"] not in {None, "VIEWER", "OPERATOR", "ADMIN"}
        or values["status"] not in {None, "ACTIVE", "DISABLED", "TEMPORARILY_LOCKED"}
        or values["sort"] not in {"created_at", "username"}
        or values["direction"] not in {"asc", "desc"}
    ):
        raise AuthError(422, "VALIDATION_ERROR")
    for key, default in [("limit", 20), ("offset", 0)]:
        raw = query.get(key, str(default))
        if not raw.isascii() or not raw.isdigit() or len(raw) > 10:
            raise AuthError(422, "VALIDATION_ERROR")
        values[key] = int(raw)
    if not 1 <= values["limit"] <= 100:
        raise AuthError(422, "VALIDATION_ERROR")
    return values


class AdminService:
    def __init__(self, service):
        self.service = service

    def read(self, context, *, target=None, query=None):
        service = self.service
        with service.transaction() as db:
            _, _, now = principal(service, db, context, ["users.manage"])
            if target is not None:
                user = db.get(User, target)
                if user is None:
                    raise AuthError(404, "TARGET_USER_NOT_FOUND")
                view = service.user_view(user, now)
                return view, etag(view)
            filters = []
            if query["q"]:
                filters.append(
                    or_(
                        User.username.icontains(query["q"], autoescape=True),
                        User.display_name.icontains(query["q"], autoescape=True),
                    )
                )
            if query["role"]:
                filters.append(User.role == query["role"])
            if query["status"] == "DISABLED":
                filters.append(User.is_active.is_(False))
            if query["status"] == "ACTIVE":
                filters.append(
                    and_(
                        User.is_active.is_(True),
                        or_(User.locked_until.is_(None), User.locked_until <= now),
                    )
                )
            if query["status"] == "TEMPORARILY_LOCKED":
                filters.append(and_(User.is_active.is_(True), User.locked_until > now))
            total = db.scalar(select(func.count()).select_from(User).where(*filters))
            column = getattr(User, query["sort"])
            order = (
                [column.desc(), User.id.desc()]
                if query["direction"] == "desc"
                else [column.asc(), User.id.asc()]
            )
            rows = db.scalars(
                select(User)
                .where(*filters)
                .order_by(*order)
                .limit(query["limit"])
                .offset(query["offset"])
            )
            return dict(
                items=[service.user_view(u, now) for u in rows],
                total=total,
                limit=query["limit"],
                offset=query["offset"],
            )

    def mutate(
        self, context, operation, payload, request_id, *, target=None, if_match=None
    ):
        s = self.service
        if target is not None:
            conditional(if_match)
        with s.hashing():
            with s.sessions() as read:
                original = read.get(User, context["user_id"])
                if original is None:
                    raise AuthError(401, "UNAUTHORIZED", clear_cookie=True)
                encoded, version = original.password_hash, original.security_version
                old_target_hash = (
                    read.scalar(select(User.password_hash).where(User.id == target))
                    if operation == "reset"
                    else None
                )
            verified = verify_password(encoded, payload.admin_password)
            replacement = (
                hash_password(payload.initial_password)
                if operation in {"create", "reset"}
                else None
            )
            unchanged = (
                verify_password(old_target_hash, payload.initial_password)
                if old_target_hash is not None
                else False
            )
            failure = None
            result = None
            try:
                with s.transaction() as db:
                    db.execute(text("SELECT pg_advisory_xact_lock(1096111176, 1)"))
                    ids = sorted(
                        {context["user_id"], *([target] if target else [])}, key=str
                    )
                    locked = {
                        u.id: u
                        for u in db.scalars(
                            select(User)
                            .where(User.id.in_(ids))
                            .order_by(User.id)
                            .with_for_update()
                        )
                    }
                    actor, row, now = principal(s, db, context, ["users.manage"])
                    if (
                        actor.password_hash != encoded
                        or actor.security_version != version
                    ):
                        raise AuthError(401, "UNAUTHORIZED", clear_cookie=True)
                    user = locked.get(target) if target else None
                    if target is not None:
                        if user is None:
                            raise AuthError(404, "TARGET_USER_NOT_FOUND")
                        if etag(s.user_view(user, now)) != if_match:
                            raise AuthError(412, "STALE_USER_VERSION")
                    # Reauth clears the caller's telemetry; remember the target
                    # state first so explicit self-unlock still rotates versions.
                    target_needs_unlock = user is not None and (
                        not user.is_active
                        or user.failed_attempts != 0
                        or user.locked_until is not None
                    )
                    if not s.password_attempt(actor, now, verified):
                        s.audit(
                            db,
                            "user.updated",
                            request_id,
                            user=actor,
                            session=row,
                            actor=True,
                            outcome="denied",
                        )
                        failure = AuthError(403, "REAUTH_FAILED")
                    elif operation == "create":
                        user = User(
                            username=payload.username,
                            display_name=payload.display_name,
                            role=payload.role,
                            password_hash=replacement,
                            is_active=True,
                            must_change_password=True,
                            created_by_user_id=actor.id,
                            updated_by_user_id=actor.id,
                        )
                        db.add(user)
                        db.flush()
                        self.audit(db, "user.created", request_id, actor, user, row)
                    else:
                        changes = payload.model_dump(exclude_unset=True)
                        if actor.id == target and (
                            operation == "reset"
                            or (
                                operation == "patch"
                                and (
                                    changes.get("is_active") is False
                                    or (
                                        "role" in changes and changes["role"] != "ADMIN"
                                    )
                                )
                            )
                        ):
                            raise AuthError(409, "SELF_OPERATION_NOT_ALLOWED")
                        if (
                            operation == "reset"
                            and old_target_hash != user.password_hash
                        ):
                            raise AuthError(412, "STALE_USER_VERSION")
                        if operation == "reset" and unchanged:
                            raise AuthError(422, "PASSWORD_UNCHANGED")
                        drop_admin = (
                            operation == "patch"
                            and user.role == "ADMIN"
                            and user.is_active
                            and (
                                changes.get("is_active") is False
                                or changes.get("role", user.role) != "ADMIN"
                            )
                        )
                        if (
                            drop_admin
                            and db.scalar(
                                select(func.count())
                                .select_from(User)
                                .where(User.role == "ADMIN", User.is_active.is_(True))
                            )
                            <= 1
                        ):
                            raise AuthError(409, "LAST_ADMIN_PROTECTED")
                        changed = False
                        revoke = False
                        codes = []
                        reason = "ADMIN_REVOKED"
                        if operation == "patch":
                            if (
                                "display_name" in changes
                                and user.display_name != changes["display_name"]
                            ):
                                user.display_name = changes["display_name"]
                                changed = True
                                codes.append("user.updated")
                            if "role" in changes and user.role != changes["role"]:
                                user.role = changes["role"]
                                changed = revoke = True
                                reason = "ROLE_CHANGED"
                                codes.append("user.role_changed")
                            if "is_active" in changes:
                                active = changes["is_active"]
                                unlock = active and target_needs_unlock
                                if user.is_active != active or unlock:
                                    user.is_active = active
                                    changed = revoke = True
                                    reason = (
                                        "ACCOUNT_UNLOCKED"
                                        if active
                                        else "ACCOUNT_DISABLED"
                                    )
                                    codes.append(
                                        "user.unlocked" if active else "user.locked"
                                    )
                                if active:
                                    user.failed_attempts = 0
                                    user.failure_window_started_at = (
                                        user.locked_until
                                    ) = None
                        elif operation == "reset":
                            user.password_hash = replacement
                            user.must_change_password = True
                            user.password_changed_at = now
                            user.failed_attempts = 0
                            user.failure_window_started_at = user.locked_until = None
                            changed = revoke = True
                            reason = "PASSWORD_RESET"
                            codes = ["auth.password_reset"]
                        else:
                            changed = revoke = True
                            codes = ["auth.sessions_revoked"]
                        if changed:
                            user.row_version += 1
                            user.updated_at = now
                            user.updated_by_user_id = actor.id
                            if revoke:
                                user.security_version += 1
                                db.execute(
                                    update(AuthSession)
                                    .where(
                                        AuthSession.user_id == user.id,
                                        AuthSession.revoked_at.is_(None),
                                    )
                                    .values(revoked_at=now, revoke_reason=reason)
                                )
                            for code in set(codes):
                                self.audit(db, code, request_id, actor, user, row)
                    if failure is None:
                        db.flush()
                        view = s.user_view(user, now)
                        result = (view, etag(view))
            except IntegrityError as exc:
                if (
                    getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
                    == "uq_auth_users_username"
                ):
                    raise AuthError(409, "USERNAME_UNAVAILABLE") from None
                raise
            if failure:
                raise failure
            return result

    @staticmethod
    def audit(db, code, request_id, actor, target, session):
        from backend.models.auth import AuthAuditEvent

        db.add(
            AuthAuditEvent(
                event_code=code,
                outcome="success",
                actor_user_id=actor.id,
                subject_user_id=target.id,
                session_id=session.id,
                request_id=UUID(str(request_id)),
                resource_type="users",
                resource_id=target.id,
                details={},
            )
        )
