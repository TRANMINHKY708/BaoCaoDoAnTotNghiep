"""Schema reserved for future what-if analysis workflows."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, JSON, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


JSON_TYPE = JSON().with_variant(JSONB, "postgresql")


class PredictionScenario(Base):
    __tablename__ = "prediction_scenarios"
    __table_args__ = (
        Index("ix_scenarios_customer_created", "customer_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
    )
    baseline_snapshot_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("customer_behavior_snapshots.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_features: Mapped[dict] = mapped_column(JSON_TYPE, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class ScenarioResult(Base):
    __tablename__ = "scenario_results"
    __table_args__ = (
        Index("ix_scenario_results_scenario_created", "scenario_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    scenario_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("prediction_scenarios.id", ondelete="CASCADE"),
        nullable=False,
    )
    model_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("ml_models.id", ondelete="RESTRICT"),
        nullable=False,
    )
    baseline_prediction_result_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("prediction_results.id", ondelete="SET NULL"),
        nullable=True,
    )
    before_result: Mapped[dict] = mapped_column(JSON_TYPE, nullable=False)
    after_result: Mapped[dict] = mapped_column(JSON_TYPE, nullable=False)
    probability_deltas: Mapped[dict] = mapped_column(JSON_TYPE, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
