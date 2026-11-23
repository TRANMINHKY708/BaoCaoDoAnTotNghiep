"""Additive F09 identity and import ledger; historical business tables unchanged."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base
from backend.models.auth import User

F09_REVISION = "f09b20261105"
F09_TABLES = {"customer_source_identities", "bulk_import_jobs", "bulk_import_rows"}


class CustomerSourceIdentity(Base):
    __tablename__ = "customer_source_identities"
    __table_args__ = (
        UniqueConstraint(
            "source_system", "external_customer_id", name="uq_bulk_source_identity"
        ),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    source_system: Mapped[str] = mapped_column(String(30), nullable=False)
    external_customer_id: Mapped[str] = mapped_column(String(100), nullable=False)
    customer_id: Mapped[UUID] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class BulkImportJob(Base):
    __tablename__ = "bulk_import_jobs"
    __table_args__ = (
        UniqueConstraint(
            "actor_user_id", "idempotency_key", name="uq_bulk_actor_request"
        ),
        CheckConstraint(
            "status IN ('pending','completed','failed')", name="bulk_job_status"
        ),
        Index("ix_bulk_jobs_actor_created", "actor_user_id", "created_at", "id"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    actor_user_id: Mapped[UUID] = mapped_column(
        ForeignKey(User.id, ondelete="RESTRICT"), nullable=False
    )
    # Not a credential; deliberately no session FK, so normal session cleanup remains possible.
    actor_session_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(36), nullable=False)
    manifest_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    file_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    counts: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    error_code: Mapped[str | None] = mapped_column(String(80))
    error_row: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BulkImportRow(Base):
    __tablename__ = "bulk_import_rows"
    __table_args__ = (
        UniqueConstraint("job_id", "row_number", name="uq_bulk_job_row"),
        UniqueConstraint("snapshot_dedupe_key", name="uq_bulk_snapshot_dedupe"),
        CheckConstraint("row_number >= 2", name="bulk_row_number"),
        CheckConstraint("status IN ('applied','excluded')", name="bulk_row_status"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    job_id: Mapped[UUID] = mapped_column(
        ForeignKey("bulk_import_jobs.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    row_key: Mapped[str | None] = mapped_column(String(64))
    snapshot_dedupe_key: Mapped[str | None] = mapped_column(String(64))
    content_hash: Mapped[str | None] = mapped_column(String(64))
    customer_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT")
    )
    snapshot_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("customer_behavior_snapshots.id", ondelete="RESTRICT")
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    outcome: Mapped[dict] = mapped_column(JSON, nullable=False)
