"""F06 export requests accept references only, never user-supplied report data."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Options(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    format: Literal["pdf", "xlsx"]


class PreviewReport(Options):
    source: Literal["preview"]
    receipt: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
    include_ai: bool = False
    include_research: bool = False


class CustomerReport(Options):
    source: Literal["customer"]
    customer_id: str = Field(pattern=r"^[0-9a-fA-F-]{36}$")
    limit: int = Field(default=20, ge=1, le=50)

    @field_validator("customer_id")
    @classmethod
    def valid_customer(cls, value):
        return str(UUID(value))


class StoredReport(Options):
    source: Literal["stored"]
    kind: Literal["prediction", "segmentation", "what_if"]
    customer_id: str = Field(pattern=r"^[0-9a-fA-F-]{36}$")
    record_id: str = Field(pattern=r"^[0-9a-fA-F-]{36}$")

    @field_validator("customer_id", "record_id")
    @classmethod
    def valid_reference(cls, value):
        return str(UUID(value))


class ChurnWatchlistReport(Options):
    """K12: the churn watchlist recomputed on the server; only the risk levels to list are chosen."""

    source: Literal["churn_watchlist"]
    risk_levels: list[Literal["high", "medium", "low"]] = Field(
        default_factory=lambda: ["high", "medium"], min_length=1, max_length=3
    )

    @field_validator("risk_levels")
    @classmethod
    def distinct_levels(cls, value):
        if len(set(value)) != len(value):
            raise ValueError("risk_levels must not repeat")
        return value


ReportRequest = Annotated[
    PreviewReport | CustomerReport | StoredReport | ChurnWatchlistReport,
    Field(discriminator="source"),
]


def reference_uuid(value):
    # Keep JSON parsing strict while accepting standard UUID strings only.
    return UUID(value)
