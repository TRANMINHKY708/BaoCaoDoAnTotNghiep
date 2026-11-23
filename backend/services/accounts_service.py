"""AUTH-02 session store. No signup, bootstrap or user administration."""

from contextlib import contextmanager
from datetime import timedelta, timezone
import hashlib
import hmac
import math
import secrets
import threading
import time
from uuid import UUID

from sqlalchemy import create_engine, delete, func, select, text, update
from sqlalchemy.orm import sessionmaker

from backend.core.passwords import hash_password, verify_password
from backend.models.auth import AuthAuditEvent, AuthSession, User

# Shared across all application instances in this interpreter, not per-app.
HASH_SLOTS = threading.BoundedSemaphore(2)


class AuthError(Exception):
    def __init__(self, status, code, *, clear_cookie=False, retry_after=None):
        super().__init__(code)
        self.status, self.code = status, code
        self.clear_cookie, self.retry_after = clear_cookie, retry_after


def digest(raw):
    return hashlib.sha256(raw.encode("ascii")).digest()


def stamp(value):
    return (
        value.astimezone(timezone.utc)
        .isoformat(timespec="microseconds")
        .replace("+00:00", "Z")
    )


class Quotas:
    """Bounded process-local windows; no distributed protection claim."""

    def __init__(self):
        self.lock = threading.Lock()
        self.buckets = {}

    def check(self, key, limit):
        now = time.monotonic()
        with self.lock:
            self.buckets = {
                k: [t for t in q if t > now - 60]
                for k, q in self.buckets.items()
                if q and q[-1] > now - 60
            }
            if key not in self.buckets and len(self.buckets) >= 4096:
                delay = max(
                    1, math.ceil(min(q[0] + 60 - now for q in self.buckets.values()))
                )
                raise AuthError(429, "RATE_LIMITED", retry_after=delay)
            q = self.buckets.setdefault(key, [])
            if len(q) >= limit:
                raise AuthError(
                    429, "RATE_LIMITED", retry_after=max(1, math.ceil(q[0] + 60 - now))
                )
            q.append(now)


class AccountsService:
    def __init__(self, settings):
        self.settings = settings
        self.engine = create_engine(
            settings.database_url,
            pool_pre_ping=True,
            echo=False,
            connect_args={"connect_timeout": 5},
        )
        self.sessions = sessionmaker(self.engine, expire_on_commit=False)
        self.hash_slots = HASH_SLOTS
        self.quotas = Quotas()
        self.preauth_lock = threading.Lock()
        self.preauth_ips = {}
        with self.hashing():
            self.dummy_hash = hash_password(secrets.token_urlsafe(24))

    @property
    def cookie_name(self):
        return (
            "mkeai_dev_session"
            if self.settings.accounts_insecure_loopback
            else "__Host-mkeai_session"
        )

    @contextmanager
    def transaction(self):
        with self.sessions() as db, db.begin():
            db.execute(text("SET LOCAL lock_timeout = '1s'"))
            yield db

    @contextmanager
    def hashing(self):
        if not self.hash_slots.acquire(blocking=False):
            raise AuthError(503, "SERVER_BUSY", retry_after=1)
        try:
            yield
        finally:
            self.hash_slots.release()

    @staticmethod
    def now(db):
        return db.scalar(select(func.clock_timestamp()))

    @staticmethod
    def find(db, raw, lock=False):
        if raw is None:
            return None
        query = (
            select(AuthSession)
            .where(AuthSession.session_token_hash == digest(raw))
            .execution_options(populate_existing=True)
        )
        if lock:
            query = query.with_for_update()
        return db.scalar(query)

    @staticmethod
    def revoke(row, now, reason):
        if row.revoked_at is None:
            row.revoked_at, row.revoke_reason = now, reason

    @staticmethod
    def audit(
        db, code, request_id, *, user=None, session=None, outcome="success", actor=False
    ):
        db.add(
            AuthAuditEvent(
                event_code=code,
                outcome=outcome,
                request_id=UUID(str(request_id)),
                actor_user_id=user.id if user is not None and actor else None,
                subject_user_id=user.id if user is not None else None,
                session_id=session.id if session is not None else None,
                details={},
            )
        )

    @staticmethod
    def user_view(user, now):
        status = (
            "DISABLED"
            if not user.is_active
            else "TEMPORARILY_LOCKED"
            if user.locked_until and user.locked_until > now
            else "ACTIVE"
        )
        return dict(
            id=str(user.id),
            username=user.username,
            display_name=user.display_name,
            role=user.role,
            is_active=user.is_active,
            must_change_password=user.must_change_password,
            created_at=stamp(user.created_at),
            updated_at=stamp(user.updated_at),
            row_version=user.row_version,
            status=status,
            locked_until=stamp(user.locked_until) if user.locked_until else None,
        )

    def context(self, row, user, now):
        return dict(
            id=row.id,
            user_id=row.user_id,
            state=row.state,
            csrf_token=row.csrf_token,
            security_version=row.security_version,
            idle_expires_at=row.idle_expires_at,
            expires_at=row.expires_at,
            user=self.user_view(user, now) if user is not None else None,
        )

    def resolve(self, raw, *, touch=True):
        if raw is None:
            return None
        result = None
        with self.transaction() as db:
            row = self.find(db, raw, lock=True)
            now = self.now(db)
            if row is not None and row.revoked_at is None:
                if now >= min(row.idle_expires_at, row.expires_at):
                    self.revoke(row, now, "EXPIRED")
                else:
                    user = db.get(User, row.user_id) if row.user_id else None
                    if row.state == "authenticated" and (
                        user is None
                        or not user.is_active
                        or row.security_version != user.security_version
                    ):
                        self.revoke(row, now, "ADMIN_REVOKED")
                    else:
                        if touch and row.state == "authenticated":
                            row.last_seen_at = max(row.last_seen_at, now)
                            row.idle_expires_at = max(
                                row.idle_expires_at,
                                min(
                                    row.expires_at,
                                    row.last_seen_at + timedelta(minutes=30),
                                ),
                            )
                        result = self.context(row, user, now)
        return result

    def retained(self, raw):
        if raw is None:
            return None
        with self.sessions() as db:
            row = self.find(db, raw)
            return {"csrf_token": row.csrf_token} if row is not None else None

    def release_preauth(self, raw):
        key = digest(raw)
        with self.preauth_lock:
            for entries in self.preauth_ips.values():
                entries.pop(key, None)

    def bootstrap(self, raw, ip):
        ctx = self.resolve(raw)
        if ctx:
            return dict(
                csrf_token=ctx["csrf_token"],
                state=ctx["state"],
                expires_at=stamp(min(ctx["expires_at"], ctx["idle_expires_at"])),
            ), None
        with self.preauth_lock:
            monotonic = time.monotonic()
            self.preauth_ips = {
                k: {d: t for d, t in v.items() if t > monotonic}
                for k, v in self.preauth_ips.items()
            }
            self.preauth_ips = {k: v for k, v in self.preauth_ips.items() if v}
            if ip not in self.preauth_ips and len(self.preauth_ips) >= 4096:
                raise AuthError(429, "RATE_LIMITED", retry_after=60)
            entries = self.preauth_ips.setdefault(ip, {})
            if len(entries) >= 2:
                raise AuthError(
                    429,
                    "RATE_LIMITED",
                    retry_after=max(1, math.ceil(min(entries.values()) - monotonic)),
                )
            token = secrets.token_urlsafe(32)
            with self.transaction() as db:
                db.execute(text("SELECT pg_advisory_xact_lock(1096111176, 2)"))
                if (
                    db.scalar(
                        select(func.count())
                        .select_from(AuthSession)
                        .where(AuthSession.state == "preauth")
                    )
                    >= 1000
                ):
                    raise AuthError(503, "SERVER_BUSY", retry_after=1)
                now = self.now(db)
                row = AuthSession(
                    state="preauth",
                    session_token_hash=digest(token),
                    csrf_token=secrets.token_urlsafe(32),
                    created_at=now,
                    last_seen_at=now,
                    expires_at=now + timedelta(minutes=5),
                    idle_expires_at=now + timedelta(minutes=5),
                )
                db.add(row)
                db.flush()
                reply = dict(
                    csrf_token=row.csrf_token,
                    state="preauth",
                    expires_at=stamp(row.expires_at),
                )
            entries[digest(token)] = monotonic + 300
            return reply, token

    @staticmethod
    def csrf(row, nonce):
        if row is None or not nonce or not hmac.compare_digest(row.csrf_token, nonce):
            raise AuthError(403, "CSRF_FAILED")

    @staticmethod
    def reset_failures(user):
        user.failed_attempts, user.failure_window_started_at, user.locked_until = (
            0,
            None,
            None,
        )

    def password_attempt(self, user, now, verified):
        if user.locked_until is not None:
            if now < user.locked_until:
                return False
            self.reset_failures(user)
        if verified:
            self.reset_failures(user)
            return True
        if (
            user.failure_window_started_at is None
            or now >= user.failure_window_started_at + timedelta(minutes=15)
        ):
            user.failure_window_started_at, user.failed_attempts = now, 0
        user.failed_attempts += 1
        if user.failed_attempts >= 5:
            user.locked_until = now + timedelta(minutes=15)
        return False

    @staticmethod
    def reply(ctx):
        from backend.core.account_permissions import capabilities
        return dict(
            user=ctx["user"],
            capabilities=capabilities(ctx["user"]),
            session={
                "idle_expires_at": stamp(ctx["idle_expires_at"]),
                "expires_at": stamp(ctx["expires_at"]),
            },
        )

    def login(self, raw, nonce, payload, request_id):
        failure, result, token = None, None, None
        with self.hashing():
            with self.sessions() as read:
                snapshot = read.scalar(
                    select(User).where(User.username == payload.username)
                )
                encoded = (
                    snapshot.password_hash if snapshot is not None else self.dummy_hash
                )
                version = snapshot.security_version if snapshot is not None else None
            verified = verify_password(encoded, payload.password)
            with self.transaction() as db:
                user = db.scalar(
                    select(User)
                    .where(User.username == payload.username)
                    .with_for_update()
                )
                row = self.find(db, raw, lock=True)
                now = self.now(db)
                self.csrf(row, nonce)
                if (
                    row.state != "preauth"
                    or row.revoked_at is not None
                    or now >= min(row.expires_at, row.idle_expires_at)
                ):
                    raise AuthError(401, "UNAUTHORIZED")
                if (
                    user is None
                    or not user.is_active
                    or user.password_hash != encoded
                    or user.security_version != version
                ):
                    failure = AuthError(401, "UNAUTHORIZED")
                elif not self.password_attempt(user, now, verified):
                    failure = AuthError(401, "UNAUTHORIZED")
                if failure:
                    self.audit(
                        db,
                        "auth.login",
                        request_id,
                        user=user,
                        session=row,
                        outcome="denied",
                    )
                else:
                    token = secrets.token_urlsafe(32)
                    new = AuthSession(
                        user_id=user.id,
                        state="authenticated",
                        security_version=user.security_version,
                        session_token_hash=digest(token),
                        csrf_token=secrets.token_urlsafe(32),
                        created_at=now,
                        last_seen_at=now,
                        expires_at=now + timedelta(hours=8),
                        idle_expires_at=now + timedelta(minutes=30),
                    )
                    db.add(new)
                    db.flush()
                    self.revoke(row, now, "PREAUTH_CONSUMED")
                    user.last_login_at = now
                    self.audit(
                        db, "auth.login", request_id, user=user, session=new, actor=True
                    )
                    ctx = self.context(new, user, now)
                    result = dict(**self.reply(ctx), csrf_token=new.csrf_token)
        if failure:
            raise failure
        self.release_preauth(raw)
        return result, token

    def logout(self, raw, nonce, request_id):
        with self.transaction() as db:
            row = self.find(db, raw, lock=True)
            self.csrf(row, nonce)
            if row.revoked_at is None:
                now = self.now(db)
                user = db.get(User, row.user_id) if row.user_id else None
                live = (
                    row.state == "authenticated"
                    and user is not None
                    and user.is_active
                    and row.security_version == user.security_version
                    and now < min(row.idle_expires_at, row.expires_at)
                )
                self.revoke(
                    row,
                    now,
                    "EXPIRED"
                    if now >= min(row.idle_expires_at, row.expires_at)
                    else "LOGOUT",
                )
                self.audit(
                    db, "auth.logout", request_id, user=user, session=row, actor=live
                )
        self.release_preauth(raw)

    def change_password(self, raw, nonce, payload, request_id):
        failure = None
        with self.hashing():
            with self.sessions() as read:
                ctx = self.find(read, raw)
                snapshot = read.get(User, ctx.user_id) if ctx and ctx.user_id else None
                if snapshot is None:
                    raise AuthError(401, "UNAUTHORIZED", clear_cookie=True)
                encoded, version, uid = (
                    snapshot.password_hash,
                    snapshot.security_version,
                    snapshot.id,
                )
            verified = verify_password(encoded, payload.current_password)
            same = hmac.compare_digest(
                payload.current_password.encode(), payload.new_password.encode()
            )
            new_hash = None
            if verified and not same:
                try:
                    new_hash = hash_password(payload.new_password)
                except ValueError:
                    raise AuthError(422, "VALIDATION_ERROR") from None
            with self.transaction() as db:
                user = db.get(User, uid, with_for_update=True)
                row = self.find(db, raw, lock=True)
                now = self.now(db)
                self.csrf(row, nonce)
                if (
                    row.state != "authenticated"
                    or row.revoked_at is not None
                    or now >= min(row.idle_expires_at, row.expires_at)
                    or not user.is_active
                    or row.security_version != user.security_version
                    or user.security_version != version
                    or user.password_hash != encoded
                ):
                    raise AuthError(401, "UNAUTHORIZED", clear_cookie=True)
                if not self.password_attempt(user, now, verified):
                    failure = AuthError(403, "REAUTH_FAILED")
                    self.audit(
                        db,
                        "auth.password_changed",
                        request_id,
                        user=user,
                        session=row,
                        actor=True,
                        outcome="denied",
                    )
                elif same:
                    failure = AuthError(422, "PASSWORD_UNCHANGED")
                else:
                    user.password_hash, user.must_change_password = new_hash, False
                    user.security_version += 1
                    user.row_version += 1
                    user.password_changed_at = user.updated_at = now
                    user.updated_by_user_id = user.id
                    db.execute(
                        update(AuthSession)
                        .where(
                            AuthSession.user_id == user.id,
                            AuthSession.revoked_at.is_(None),
                        )
                        .values(revoked_at=now, revoke_reason="PASSWORD_CHANGED")
                    )
                    self.audit(
                        db,
                        "auth.password_changed",
                        request_id,
                        user=user,
                        session=row,
                        actor=True,
                    )
        if failure:
            raise failure

    def cleanup(self):
        """Bounded primitive, not a scheduled worker. Never deletes users/audit."""
        counts = {"preauth": 0, "authenticated": 0}
        for state, age, batches in (
            # Eligible at expiry: a future minute-based job can meet the
            # target of cleanup within five minutes after expiry. Waiting
            # another five minutes here would make that target impossible.
            ("preauth", timedelta(), 10),
            ("authenticated", timedelta(days=7), 1),
        ):
            for _ in range(batches):
                with self.transaction() as db:
                    now = self.now(db)
                    ids = list(
                        db.scalars(
                            select(AuthSession.id)
                            .where(
                                AuthSession.state == state,
                                AuthSession.expires_at <= now - age,
                            )
                            .order_by(AuthSession.expires_at)
                            .limit(100)
                            .with_for_update(skip_locked=True)
                        )
                    )
                    if ids:
                        db.execute(delete(AuthSession).where(AuthSession.id.in_(ids)))
                    counts[state] += len(ids)
                if len(ids) < 100:
                    break
        return counts
