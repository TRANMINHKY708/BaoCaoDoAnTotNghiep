"""F11 accepts filters/references, never client-provided statistics or AI text."""

from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import Field, StringConstraints, field_validator, model_validator

from backend.schemas.narrative import NarrativeContent
from backend.schemas.v1 import StrictObject

Sha = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]


class BatchFilters(StrictObject):
    import_job_id: UUID | None = None
    analysis_job_id: UUID | None = None
    classification_version: Literal["1.0.0", "2.0.0-snapshot-conservative12"] = "1.0.0"
    segmentation_version: Literal["1.0.0", "2.0.0-snapshot-k3"] = "1.0.0"
    classification_artifact: Sha | None = None
    classification_metadata: Sha | None = None
    segmentation_artifact: Sha | None = None
    segmentation_metadata: Sha | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    purchase_level: Literal["Low", "Medium", "High"] | None = None
    cluster: Annotated[int, Field(ge=0, le=2)] | None = None
    customer_query: (
        Annotated[
            str, StringConstraints(min_length=1, max_length=100, strip_whitespace=True)
        ]
        | None
    ) = None

    @field_validator("cluster", mode="before")
    @classmethod
    def cluster_identifier(cls, value):
        if (
            value is None
            or type(value) is int
            or isinstance(value, str)
            and value in {"0", "1", "2"}
        ):
            return value
        raise ValueError("Cluster ID phải là số nguyên 0, 1 hoặc 2.")

    @model_validator(mode="after")
    def coherent(self):
        for task in ("classification", "segmentation"):
            if (getattr(self, task + "_artifact") is None) != (
                getattr(self, task + "_metadata") is None
            ):
                raise ValueError(
                    "Chọn đầy đủ danh tính artifact và metadata của mô hình."
                )
        if (self.date_from is None) != (self.date_to is None):
            raise ValueError("Cần cả thời điểm bắt đầu và kết thúc.")
        if self.date_from is not None:
            if self.date_from.utcoffset() is None or self.date_to.utcoffset() is None:
                raise ValueError("Thời gian cần có múi giờ.")
            if self.date_from >= self.date_to:
                raise ValueError(
                    "Khoảng thời gian phải tăng dần; thời điểm cuối không bao gồm."
                )
        return self


class BatchAction(StrictObject):
    filters: BatchFilters
    fingerprint: Sha


class BatchExport(BatchAction):
    source: Literal["batch_analytics"] = "batch_analytics"
    format: Literal["pdf", "xlsx"]


class BatchViewRequest(StrictObject):
    filters: BatchFilters = Field(default_factory=BatchFilters)
    offset: int = Field(default=0, ge=0, le=1000000)
    limit: int = Field(default=50, ge=1, le=100)


class BatchQuery(BatchFilters):
    offset: int = Field(default=0, ge=0, le=1000000)
    limit: int = Field(default=50, ge=1, le=100)


class BatchView(StrictObject):
    source: Literal["postgresql_f09_f10_saved_history"] = (
        "postgresql_f09_f10_saved_history"
    )
    as_of: datetime
    timezone: Literal["Asia/Ho_Chi_Minh"] = "Asia/Ho_Chi_Minh"
    filters: BatchFilters
    fingerprint: Sha
    kpis: dict[str, int]
    definitions: dict[str, str]
    models: list[dict[str, Any]]
    data_origins: list[str] = Field(default_factory=list)
    purchase_distribution: list[dict[str, Any]]
    cluster_distribution: list[dict[str, Any]]
    cluster_profiles: list[dict[str, Any]]
    overall_means: dict[str, float | None]
    trend: list[dict[str, Any]]
    trend_available: bool
    warnings: list[str]
    total_rows: int
    offset: int
    limit: int
    rows: list[dict[str, Any]]


class BatchNarrative(StrictObject):
    narrative: NarrativeContent
    result_fingerprint: Sha
    source: Literal["verified_batch_aggregates"] = "verified_batch_aggregates"
    generated_at: datetime
    history_persisted: Literal[False] = False


class BatchOptions(StrictObject):
    scope: Literal["shared_workspace_read_only"] = "shared_workspace_read_only"
    imports: list[dict[str, Any]]
    analyses: list[dict[str, Any]]
    models: list[dict[str, Any]]
    truncated: dict[str, bool]
    limit: int
