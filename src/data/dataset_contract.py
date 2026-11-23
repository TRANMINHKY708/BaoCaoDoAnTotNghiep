"""Research snapshot contract v1; independent of the public API contract.

No imputation, clipping, rounding, model fitting, or database mutation happens
here. Event-time availability of the original CSV cannot be inferred.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from numbers import Real
from typing import Iterable
from uuid import UUID

import numpy as np
import pandas as pd

from src.features.purchase_level_rules import CLASS_ORDER, create_purchase_level


CONTRACT_VERSION = "research-snapshot-v1"
TARGET = "Purchase_Level"


@dataclass(frozen=True)
class FieldSpec:
    name: str
    column: str
    kind: str = "number"
    minimum: float | None = 0
    maximum: float | None = None
    categories: tuple[str, ...] = ()


# The order matches the existing cleaned CSV, not an inferred business schema.
FIELDS = (
    FieldSpec("Age", "age", minimum=18, maximum=100),
    FieldSpec("Gender", "gender", kind="text", minimum=None),
    FieldSpec("Country", "country", kind="text", minimum=None),
    FieldSpec("City", "city", kind="text", minimum=None),
    FieldSpec("Membership_Years", "membership_years"),
    FieldSpec("Login_Frequency", "login_frequency"),
    FieldSpec("Session_Duration_Avg", "session_duration_avg"),
    FieldSpec("Pages_Per_Session", "pages_per_session"),
    FieldSpec("Cart_Abandonment_Rate", "cart_abandonment_rate", maximum=100),
    FieldSpec("Wishlist_Items", "wishlist_items"),
    FieldSpec("Total_Purchases", "total_purchases"),
    FieldSpec("Average_Order_Value", "average_order_value"),
    FieldSpec("Days_Since_Last_Purchase", "days_since_last_purchase"),
    FieldSpec("Discount_Usage_Rate", "discount_usage_rate", maximum=100),
    FieldSpec("Returns_Rate", "returns_rate", maximum=100),
    FieldSpec("Email_Open_Rate", "email_open_rate", maximum=100),
    FieldSpec("Customer_Service_Calls", "customer_service_calls"),
    FieldSpec("Product_Reviews_Written", "product_reviews_written"),
    FieldSpec("Social_Media_Engagement_Score", "social_media_engagement_score"),
    FieldSpec("Mobile_App_Usage", "mobile_app_usage"),
    FieldSpec("Payment_Method_Diversity", "payment_method_diversity"),
    FieldSpec("Lifetime_Value", "lifetime_value"),
    FieldSpec("Credit_Balance", "credit_balance"),
    FieldSpec("Churned", "churned", kind="binary", maximum=1),
    FieldSpec(
        "Signup_Quarter", "signup_quarter", kind="text", minimum=None,
        categories=("Q1", "Q2", "Q3", "Q4"),
    ),
)
FEATURE_COLUMNS = tuple(field.name for field in FIELDS)
CLASSIFICATION_FEATURES = tuple(
    name for name in FEATURE_COLUMNS if name != "Total_Purchases"
)
SNAPSHOT_TO_FEATURE = {field.column: field.name for field in FIELDS}


class DatasetValidationError(ValueError):
    """A contract violation with field/rule names, never entire customer rows."""


def validate_research_frame(
    frame: pd.DataFrame, *, require_target: bool = True
) -> None:
    """Check the complete cleaned research snapshot schema without repairing it."""
    if not isinstance(frame, pd.DataFrame) or frame.empty:
        raise DatasetValidationError("Dataset must be a nonempty DataFrame")
    if not frame.columns.is_unique:
        raise DatasetValidationError("Duplicate column names")
    if not frame.index.is_unique:
        raise DatasetValidationError("Duplicate row keys (DataFrame index)")
    expected = set(FEATURE_COLUMNS) | ({TARGET} if require_target else set())
    missing = sorted(expected - set(frame.columns))
    extra = sorted(set(frame.columns) - expected)
    if missing or extra:
        raise DatasetValidationError(f"Schema mismatch: missing={missing}; extra={extra}")
    if frame.isna().any().any():
        columns = frame.columns[frame.isna().any()].tolist()
        raise DatasetValidationError(f"Missing values: {columns}")
    if frame.duplicated(subset=list(FEATURE_COLUMNS)).any():
        raise DatasetValidationError("Duplicate feature rows")

    for field in FIELDS:
        series = frame[field.name]
        if field.kind == "text":
            if not series.map(lambda value: isinstance(value, str) and bool(value.strip())).all():
                raise DatasetValidationError(f"{field.name}: expected nonblank strings")
            if field.categories and not series.isin(field.categories).all():
                raise DatasetValidationError(f"{field.name}: unsupported category")
            continue

        # Refuse numeric-looking strings and boolean values; CSV parsing is an
        # explicit boundary. API/DB boolean Churned is converted by the adapter.
        if not series.map(
            lambda value: isinstance(value, Real) and not isinstance(value, (bool, np.bool_))
        ).all():
            raise DatasetValidationError(f"{field.name}: expected numeric values")
        if not np.isfinite(series.to_numpy(dtype=float)).all():
            raise DatasetValidationError(f"{field.name}: values must be finite")
        if field.minimum is not None and (series < field.minimum).any():
            raise DatasetValidationError(f"{field.name}: below minimum {field.minimum}")
        if field.maximum is not None and (series > field.maximum).any():
            raise DatasetValidationError(f"{field.name}: above maximum {field.maximum}")
        if field.kind == "binary" and not series.isin([0, 1]).all():
            raise DatasetValidationError(f"{field.name}: expected 0 or 1")

    if require_target:
        if not frame[TARGET].isin(CLASS_ORDER).all():
            raise DatasetValidationError("Purchase_Level: invalid class")
        expected_target = frame["Total_Purchases"].map(create_purchase_level)
        if not frame[TARGET].eq(expected_target).all():
            raise DatasetValidationError("Purchase_Level does not match fixed thresholds")


def build_research_dataset(cleaned: pd.DataFrame) -> pd.DataFrame:
    """Reuse fixed target rules; preserve values and one row per source row."""
    validate_research_frame(cleaned, require_target=False)
    result = cleaned.loc[:, list(FEATURE_COLUMNS)].copy()
    result[TARGET] = result["Total_Purchases"].map(create_purchase_level)
    validate_research_frame(result)
    return result


def validate_snapshot_provenance(
    snapshots: pd.DataFrame,
    known_customer_ids: Iterable[str],
    *,
    as_of: datetime,
) -> None:
    """Validate optional DB export keys/time, without inventing CSV timestamps.

    captured_at is a recorded snapshot time, not proof that every underlying
    event/aggregate was available at that time. This check cannot certify that.
    """
    if as_of.tzinfo is None or as_of.utcoffset() is None:
        raise DatasetValidationError("as_of must be timezone-aware")
    required = {"id", "customer_id", "captured_at"}
    if not required.issubset(snapshots.columns):
        raise DatasetValidationError("Snapshot provenance columns are missing")
    if snapshots.empty or snapshots[list(required)].isna().any().any():
        raise DatasetValidationError("Snapshot provenance must be nonempty and nonnull")
    for key in ("id", "customer_id"):
        if snapshots[key].map(lambda value: not str(value).strip()).any():
            raise DatasetValidationError("Snapshot keys must not be blank")

    def uuid_key(value) -> str:
        try:
            return str(UUID(str(value)))
        except (ValueError, TypeError, AttributeError) as exc:
            raise DatasetValidationError("Snapshot keys must be valid UUIDs") from exc

    if snapshots["id"].map(uuid_key).duplicated().any():
        raise DatasetValidationError("Duplicate snapshot keys")
    allowed = {uuid_key(value) for value in known_customer_ids}
    if not snapshots["customer_id"].map(uuid_key).isin(allowed).all():
        raise DatasetValidationError("Snapshot customer_id foreign key is unknown")
    cutoff = as_of.astimezone(timezone.utc)
    for value in snapshots["captured_at"]:
        try:
            timestamp = pd.Timestamp(value)
        except (ValueError, TypeError, OverflowError) as exc:
            raise DatasetValidationError("Invalid captured_at timestamp") from exc
        if pd.isna(timestamp) or timestamp.tzinfo is None:
            raise DatasetValidationError("captured_at must be timezone-aware")
        if timestamp.tz_convert("UTC").to_pydatetime() > cutoff:
            raise DatasetValidationError("captured_at is after as_of")


def build_snapshot_research_dataset(
    snapshots: pd.DataFrame,
    known_customer_ids: Iterable[str],
    *,
    as_of: datetime,
) -> pd.DataFrame:
    """Adapt an explicit snapshot export; no joins, latest-row guess or DB writes.

    The caller supplies known customers from the same export/transaction.
    Identity and timestamps stay outside ML features; index retains snapshot ID.
    """
    validate_snapshot_provenance(snapshots, known_customer_ids, as_of=as_of)
    missing = set(SNAPSHOT_TO_FEATURE) - set(snapshots.columns)
    if missing:
        raise DatasetValidationError(f"Snapshot behavior columns missing: {sorted(missing)}")
    result = snapshots.loc[:, list(SNAPSHOT_TO_FEATURE)].rename(
        columns=SNAPSHOT_TO_FEATURE
    ).copy()
    result.index = snapshots["id"].map(str).to_numpy()
    result.index.name = "snapshot_id"
    result["Churned"] = result["Churned"].map(
        lambda value: int(value) if isinstance(value, (bool, np.bool_)) else value
    )
    return build_research_dataset(result)
