"""Machine-learning model registry."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Index,
    JSON,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


JSON_TYPE = JSON().with_variant(JSONB, "postgresql")


class MLModel(Base):
    __tablename__ = "ml_models"
    __table_args__ = (
        UniqueConstraint("name", "version", name="model_name_version"),
        CheckConstraint(
            "task IN ('classification', 'segmentation', 'what_if')",
            name="task_values",
        ),
        Index("ix_ml_models_task_active", "task", "is_active"),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    task: Mapped[str] = mapped_column(String(30), nullable=False)
    algorithm: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    artifact_path: Mapped[str] = mapped_column(String(500), nullable=False)
    metadata_path: Mapped[str] = mapped_column(String(500), nullable=False)
    artifact_checksum: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )
    metadata_json: Mapped[dict] = mapped_column(
        JSON_TYPE,
        nullable=False,
        default=dict,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
