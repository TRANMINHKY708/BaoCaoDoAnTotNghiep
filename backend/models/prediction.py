"""Prediction execution and result history models."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    SmallInteger,
    String,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


JSON_TYPE = JSON().with_variant(JSONB, "postgresql")


class PredictionRun(Base):
    __tablename__ = "prediction_runs"
    __table_args__ = (
        CheckConstraint(
            "run_type IN ('single', 'batch', 'csv', 'scenario')",
            name="run_type_values",
        ),
        CheckConstraint(
            "task IN ('classification', 'segmentation')",
            name="run_task_values",
        ),
        CheckConstraint(
            "status IN ('pending', 'completed', 'failed')",
            name="run_status_values",
        ),
        CheckConstraint(
            "requested_count >= 0 AND success_count >= 0 "
            "AND failure_count >= 0",
            name="run_counts_nonnegative",
        ),
        Index("ix_prediction_runs_task_created", "task", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    model_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("ml_models.id", ondelete="RESTRICT"),
        nullable=False,
    )
    task: Mapped[str] = mapped_column(String(30), nullable=False)
    run_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="api",
        server_default="api",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="completed",
        server_default="completed",
    )
    requested_count: Mapped[int] = mapped_column(Integer, nullable=False)
    success_count: Mapped[int] = mapped_column(Integer, nullable=False)
    failure_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    persist_results: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    error_message: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        server_default=func.now(),
    )


class PredictionResult(Base):
    __tablename__ = "prediction_results"
    __table_args__ = (
        CheckConstraint(
            "purchase_level IN ('Low', 'Medium', 'High')",
            name="purchase_level_values",
        ),
        CheckConstraint(
            "predicted_class BETWEEN 0 AND 2",
            name="predicted_class_range",
        ),
        CheckConstraint(
            "probability_low BETWEEN 0 AND 1 "
            "AND probability_medium BETWEEN 0 AND 1 "
            "AND probability_high BETWEEN 0 AND 1",
            name="probabilities_range",
        ),
        Index("ix_prediction_results_customer_created", "customer_id", "created_at"),
        Index("ix_prediction_results_run", "run_id"),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    run_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("prediction_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    model_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("ml_models.id", ondelete="RESTRICT"),
        nullable=False,
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
    )
    behavior_snapshot_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("customer_behavior_snapshots.id", ondelete="SET NULL"),
        nullable=True,
    )
    input_features: Mapped[dict] = mapped_column(JSON_TYPE, nullable=False)
    predicted_class: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    purchase_level: Mapped[str] = mapped_column(String(10), nullable=False)
    probability_low: Mapped[float] = mapped_column(Float, nullable=False)
    probability_medium: Mapped[float] = mapped_column(Float, nullable=False)
    probability_high: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class SegmentationResult(Base):
    __tablename__ = "segmentation_results"
    __table_args__ = (
        CheckConstraint("cluster >= 0", name="cluster_nonnegative"),
        CheckConstraint(
            "distance_to_centroid >= 0",
            name="distance_nonnegative",
        ),
        Index("ix_segmentation_results_customer_created", "customer_id", "created_at"),
        Index("ix_segmentation_results_run", "run_id"),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    run_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("prediction_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    model_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("ml_models.id", ondelete="RESTRICT"),
        nullable=False,
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
    )
    behavior_snapshot_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("customer_behavior_snapshots.id", ondelete="SET NULL"),
        nullable=True,
    )
    input_features: Mapped[dict] = mapped_column(JSON_TYPE, nullable=False)
    cluster: Mapped[int] = mapped_column(Integer, nullable=False)
    segment_name: Mapped[str] = mapped_column(String(150), nullable=False)
    distance_to_centroid: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
