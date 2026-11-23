"""AUTH-01 auth schema, separate from the historical eight business models."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    BigInteger,
    LargeBinary,
    MetaData,
    SmallInteger,
    String,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from backend.db.base import NAMING_CONVENTION

AUTH_REVISION = "a02e4cf78001"
# AUTH-02 schema plus later additive revisions (F09 bulk import, F10 batch analysis).
AUTH_COMPATIBLE_REVISIONS = frozenset({AUTH_REVISION, "f09b20261105", "f10b20261105"})
LEGACY_REVISION = "df1cb0e019c4"


class AuthBase(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class User(AuthBase):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("username", name="uq_auth_users_username"),
        CheckConstraint(
            "username ~ '^[a-z0-9][a-z0-9._-]{2,63}$'", name="username_canonical"
        ),
        CheckConstraint(
            "char_length(display_name) >= 1 AND char_length(display_name) <= 100",
            name="display_name_length",
        ),
        CheckConstraint("role IN ('ADMIN','OPERATOR','VIEWER')", name="role_values"),
        CheckConstraint(
            "security_version >= 1 AND row_version >= 1", name="versions_positive"
        ),
        CheckConstraint("failed_attempts BETWEEN 0 AND 5", name="failures_range"),
        CheckConstraint(
            "(failed_attempts = 0) = (failure_window_started_at IS NULL)",
            name="failure_window",
        ),
        CheckConstraint(
            "locked_until IS NULL OR (failed_attempts = 5 AND failure_window_started_at IS NOT NULL)",
            name="lock_consistency",
        ),
        CheckConstraint("updated_at >= created_at", name="timestamps"),
        Index("ix_auth_users_role_active", "role", "is_active"),
        Index("ix_auth_users_created", "created_at", "id"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    username: Mapped[str] = mapped_column(String(64), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, server_default=text("true"), nullable=False
    )
    must_change_password: Mapped[bool] = mapped_column(
        Boolean, server_default=text("true"), nullable=False
    )
    security_version: Mapped[int] = mapped_column(
        BigInteger, server_default="1", nullable=False
    )
    row_version: Mapped[int] = mapped_column(
        BigInteger, server_default="1", nullable=False
    )
    failed_attempts: Mapped[int] = mapped_column(
        Integer, server_default="0", nullable=False
    )
    failure_window_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    password_changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT")
    )
    updated_by_user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT")
    )


class AuthSession(AuthBase):
    __tablename__ = "auth_sessions"
    __table_args__ = (
        UniqueConstraint("session_token_hash", name="uq_auth_session_digest"),
        CheckConstraint("state IN ('preauth','authenticated')", name="state_values"),
        CheckConstraint("octet_length(session_token_hash) = 32", name="digest_length"),
        CheckConstraint("csrf_token ~ '^[A-Za-z0-9_-]{43}$'", name="csrf_format"),
        CheckConstraint(
            "(state = 'preauth' AND user_id IS NULL AND security_version IS NULL) OR (state = 'authenticated' AND user_id IS NOT NULL AND security_version IS NOT NULL AND security_version >= 1)",
            name="identity_state",
        ),
        CheckConstraint(
            "expires_at > created_at AND last_seen_at >= created_at AND idle_expires_at > created_at AND idle_expires_at <= expires_at",
            name="timestamps",
        ),
        CheckConstraint(
            "(revoked_at IS NULL) = (revoke_reason IS NULL)", name="revocation_pair"
        ),
        CheckConstraint(
            "revoked_at IS NULL OR revoked_at >= created_at", name="revoked_timestamp"
        ),
        CheckConstraint(
            "revoke_reason IN ('LOGOUT','PASSWORD_CHANGED','PASSWORD_RESET','ROLE_CHANGED','ACCOUNT_DISABLED','ACCOUNT_UNLOCKED','ADMIN_REVOKED','PREAUTH_CONSUMED','EXPIRED')",
            name="revoke_reason_values",
        ),
        Index("ix_auth_sessions_expiry", "expires_at"),
        Index(
            "ix_auth_sessions_user_live",
            "user_id",
            "expires_at",
            postgresql_where=text("revoked_at IS NULL"),
        ),
        Index(
            "ix_auth_sessions_preauth",
            "expires_at",
            postgresql_where=text("state = 'preauth'"),
        ),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT")
    )
    state: Mapped[str] = mapped_column(String(16), nullable=False)
    session_token_hash: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    csrf_token: Mapped[str] = mapped_column(String(43), nullable=False)
    security_version: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    idle_expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoke_reason: Mapped[str | None] = mapped_column(String(32))


class AuthAuditEvent(AuthBase):
    __tablename__ = "auth_audit_events"
    __table_args__ = (
        CheckConstraint(
            "event_code IN ('auth.bootstrap','auth.login','auth.logout','auth.password_changed','auth.password_reset','auth.sessions_revoked','user.created','user.updated','user.locked','user.unlocked','user.role_changed','business.created','business.updated','business.replayed')",
            name="event_values",
        ),
        CheckConstraint(
            "outcome IN ('success','denied','failure')", name="outcome_values"
        ),
        CheckConstraint(
            "resource_type IN ('users','customer','snapshot','prediction_run','scenario')",
            name="resource_types",
        ),
        CheckConstraint(
            "(resource_type IS NULL) = (resource_id IS NULL)", name="resource_pair"
        ),
        CheckConstraint(
            "details_version = 1 AND jsonb_typeof(details) = 'object' AND octet_length(details::text) <= 2048",
            name="details_envelope",
        ),
        Index("ix_auth_audit_actor", "actor_user_id", "occurred_at", "id"),
        Index("ix_auth_audit_subject", "subject_user_id", "occurred_at", "id"),
        Index("ix_auth_audit_resource", "resource_type", "resource_id", "occurred_at"),
        Index("ix_auth_audit_time", "occurred_at", "id"),
        Index(
            "uq_auth_audit_creation",
            "resource_type",
            "resource_id",
            unique=True,
            postgresql_where=text(
                "event_code = 'business.created' AND outcome = 'success'"
            ),
        ),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    actor_user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT")
    )
    subject_user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT")
    )
    session_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("auth_sessions.id", ondelete="SET NULL")
    )
    event_code: Mapped[str] = mapped_column(String(64), nullable=False)
    outcome: Mapped[str] = mapped_column(String(16), nullable=False)
    request_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    resource_type: Mapped[str | None] = mapped_column(String(40))
    resource_id: Mapped[UUID | None] = mapped_column(Uuid)
    details_version: Mapped[int] = mapped_column(
        SmallInteger, server_default="1", nullable=False
    )
    details: Mapped[dict] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )
