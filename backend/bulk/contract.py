"""Versioned enterprise boundary; keeps historical research/API contracts intact."""

import re
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    create_model,
    field_validator,
    model_validator,
)

from backend.schemas import v1
from src.data.dataset_contract import FIELDS

VERSION = "bulk-input-v1"
MAX_BYTES = 10 * 1024 * 1024
MAX_ROWS = 1000
METADATA = (
    "external_id",
    "captured_at",
    "source",
    "observation_start",
    "observation_end",
    "currency",
)
MODEL_SCHEMAS = {
    ("classification", "1.0.0"): v1.LegacyPurchaseCustomer,
    ("classification", "2.0.0-snapshot-conservative12"): v1.T4PurchaseCustomer,
    ("segmentation", "1.0.0"): v1.LegacySegmentCustomer,
    ("segmentation", "2.0.0-snapshot-k3"): v1.T5SegmentCustomer,
}
FORBIDDEN = {
    "Purchase_Level",
    "Purchase_Level_Predicted",
    "Predicted_Class",
    "Probability_Low",
    "Probability_Medium",
    "Probability_High",
    "Cluster",
    "Segment_ID",
    "Segment_Name",
    "Model_ID",
    "Model_Version",
    "Generated_At",
    "customer_id",
    "snapshot_id",
    "password",
    "token",
    "api_key",
}
RATES = {
    "Cart_Abandonment_Rate",
    "Discount_Usage_Rate",
    "Returns_Rate",
    "Email_Open_Rate",
}
MONEY_FIELDS = {"Average_Order_Value", "Lifetime_Value", "Credit_Balance"}


class Strict(BaseModel):
    model_config = ConfigDict(
        extra="forbid", strict=True, allow_inf_nan=False, hide_input_in_errors=True
    )


def identity(value):
    if (
        not isinstance(value, str)
        or not value
        or value != value.strip()
        or len(value) > 100
        or any(ord(c) < 32 or ord(c) == 127 for c in value)
    ):
        raise ValueError("Invalid stable identifier")
    return value


def timestamp(value):
    if isinstance(value, str):
        if not re.fullmatch(
            r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})",
            value,
        ):
            raise ValueError("Explicit RFC3339 timezone required")
        value = datetime.fromisoformat(value)
    if (
        not isinstance(value, datetime)
        or value.tzinfo is None
        or value.utcoffset() is None
    ):
        raise ValueError("Explicit timezone required")
    return value.astimezone(UTC)


class BehaviorMetadata(Strict):
    external_id: str
    captured_at: AwareDatetime
    source: str = Field(min_length=1, max_length=30)
    observation_start: AwareDatetime | None = None
    observation_end: AwareDatetime | None = None
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")

    _identity = field_validator("external_id")(identity)
    _time = field_validator("captured_at", mode="before")(timestamp)

    @field_validator("observation_start", "observation_end", mode="before")
    @classmethod
    def optional_time(cls, value):
        return None if value is None else timestamp(value)

    @field_validator("source")
    @classmethod
    def source_text(cls, value):
        if value != value.strip() or any(ord(c) < 32 for c in value):
            raise ValueError("Invalid source")
        return value

    @model_validator(mode="after")
    def window(self):
        start, end = self.observation_start, self.observation_end
        if (start is None) != (end is None) or (
            start is not None and not (start < end <= self.captured_at)
        ):
            raise ValueError("Invalid observation interval")
        return self


def _feature_fields():
    fields = {}
    for spec in FIELDS:
        if spec.kind == "text":
            dtype = Literal[spec.categories] if spec.categories else str
            options = (
                {}
                if spec.categories
                else {
                    "min_length": 1,
                    "max_length": {"Gender": 50, "Country": 100, "City": 150}[
                        spec.name
                    ],
                    "pattern": r"\S",
                    "strict": True,
                }
            )
        else:
            dtype = float
            options = {"ge": spec.minimum, "strict": True}
            if spec.maximum is not None:
                options["le"] = spec.maximum
        fields[spec.name] = (Annotated[dtype | None, Field(**options)], None)
    return fields


BehaviorRow = create_model(
    "BulkBehaviorRow", __base__=BehaviorMetadata, **_feature_fields()
)


class OrderRow(Strict):
    order_id: str
    external_id: str
    ordered_at: AwareDatetime
    observed_at: AwareDatetime
    source: str = Field(min_length=1, max_length=30)
    order_status: Literal["completed", "cancelled", "refunded"]
    order_total: Decimal = Field(ge=0, max_digits=20, decimal_places=4)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    discount_amount: Decimal | None = Field(
        default=None, ge=0, max_digits=20, decimal_places=4
    )
    payment_method: str | None = Field(default=None, min_length=1, max_length=50)

    _identity = field_validator("order_id", "external_id")(identity)
    _time = field_validator("ordered_at", "observed_at", mode="before")(timestamp)
    _source = field_validator("source")(BehaviorMetadata.source_text.__func__)

    @model_validator(mode="after")
    def chronology(self):
        if self.ordered_at > self.observed_at:
            raise ValueError("Order after observation")
        return self


def catalog():
    """Machine-readable metadata, not a claim of training/business unit equivalence."""
    units = {
        "Age": "years",
        "Membership_Years": "years",
        "Days_Since_Last_Purchase": "days",
        **{
            name: "category" for name in ("Gender", "Country", "City", "Signup_Quarter")
        },
        "Churned": "binary_0_1_snapshot_not_future",
        **{name: "percent_0_100" for name in RATES},
        **{name: "source_currency_dataset_unit_unverified" for name in MONEY_FIELDS},
    }
    return {
        "contract_version": VERSION,
        "limits": {"max_bytes": MAX_BYTES, "max_rows": MAX_ROWS},
        "identity": {
            "key": "external_id",
            "case_sensitive": True,
            "trim_or_cast": False,
            "database_lookup_performed": False,
        },
        "behavior_required_metadata": ["external_id", "captured_at", "source"],
        "behavior_optional_metadata": [
            "observation_start",
            "observation_end",
            "currency",
        ],
        "behavior_features": [
            {
                "name": f.name,
                "type": f.kind,
                "unit": units.get(f.name, "source_defined_observation_scope_required"),
                "minimum": f.minimum,
                "maximum": f.maximum,
                "categories": list(f.categories),
                "required_snapshot_profile": True,
                "model_input_required": "selected_model_union",
                "missing": "only_null_when_all_selected_models_allow",
            }
            for f in FIELDS
        ],
        "models": [
            {
                "task": task,
                "version": version,
                "features": list(schema.model_fields),
                "persistence_allowed": version == "1.0.0",
                "nullable": version != "1.0.0",
            }
            for (task, version), schema in MODEL_SCHEMAS.items()
        ],
        "order_schema": OrderRow.model_json_schema(),
        "order_support": "contract_validation_only_no_aggregation_or_ml_projection",
        "target": {
            "name": "Purchase_Level",
            "input_allowed": False,
            "thresholds": {"low_inclusive": 10, "medium_inclusive": 15},
        },
    }
