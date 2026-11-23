"""F10 durable checkpoints. Research inference outputs never enter these tables."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base
from backend.models.auth import User

F10_REVISION = "f10b20261105"
F10_TABLES = {"bulk_analysis_jobs", "bulk_analysis_items"}


class BulkAnalysisJob(Base):
    __tablename__ = "bulk_analysis_jobs"
    __table_args__ = (
        UniqueConstraint("plan_key", name="uq_analysis_plan"),
        CheckConstraint(
            "status IN ('queued','running','completed','failed')",
            name="analysis_status",
        ),
        CheckConstraint(
            "task IN ('classification','segmentation')", name="analysis_task"
        ),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    import_job_id: Mapped[UUID] = mapped_column(
        ForeignKey("bulk_import_jobs.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    actor_user_id: Mapped[UUID] = mapped_column(
        ForeignKey(User.id, ondelete="RESTRICT"), nullable=False, index=True
    )
    plan_key: Mapped[str] = mapped_column(String(64), nullable=False)
    task: Mapped[str] = mapped_column(String(20), nullable=False)
    model_version: Mapped[str] = mapped_column(String(80), nullable=False)
    artifact_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    metadata_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    persist_results: Mapped[bool] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued")
    counts: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_code: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BulkAnalysisItem(Base):
    __tablename__ = "bulk_analysis_items"
    __table_args__ = (
        UniqueConstraint("job_id", "snapshot_id", name="uq_analysis_job_snapshot"),
        UniqueConstraint("dedupe_key", name="uq_analysis_saved_snapshot"),
        CheckConstraint(
            "status IN ('queued','success','skipped','failed')",
            name="analysis_item_status",
        ),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    job_id: Mapped[UUID] = mapped_column(
        ForeignKey("bulk_analysis_jobs.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    customer_id: Mapped[UUID] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False
    )
    snapshot_id: Mapped[UUID] = mapped_column(
        ForeignKey("customer_behavior_snapshots.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued")
    error_code: Mapped[str | None] = mapped_column(String(80))
    dedupe_key: Mapped[str | None] = mapped_column(String(64))
    prediction_result_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("prediction_results.id", ondelete="RESTRICT")
    )
    segmentation_result_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("segmentation_results.id", ondelete="RESTRICT")
    )
