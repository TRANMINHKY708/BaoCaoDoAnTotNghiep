"""Schemas used by the AI prediction endpoints."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    customer: dict[str, Any] = Field(
        ...,
        min_length=1,
        description="Thông tin đặc trưng của một khách hàng",
    )
    save_result: bool = False
    customer_id: UUID | None = None
    behavior_snapshot_id: UUID | None = None


class BatchPredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    customers: list[dict[str, Any]] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Danh sách từ 1 đến 100 khách hàng",
    )
    save_results: bool = False
    customer_ids: list[UUID | None] | None = None
    behavior_snapshot_ids: list[UUID | None] | None = None

    @model_validator(mode="after")
    def validate_link_lengths(self):
        expected = len(self.customers)
        for field_name in ("customer_ids", "behavior_snapshot_ids"):
            values = getattr(self, field_name)
            if values is not None and len(values) != expected:
                raise ValueError(
                    f"{field_name} must contain exactly {expected} items"
                )
        return self
