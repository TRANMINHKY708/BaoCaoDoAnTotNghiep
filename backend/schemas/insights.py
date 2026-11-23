"""Versioned, read-only insight contract. No client statistics accepted."""

from datetime import datetime
from typing import Any, Literal

from backend.schemas.batch_analytics import BatchFilters, Sha
from backend.schemas.v1 import StrictObject

FeatureKey = Literal[
    "Login_Frequency",
    "Session_Duration_Avg",
    "Pages_Per_Session",
    "Cart_Abandonment_Rate",
    "Wishlist_Items",
    "Total_Purchases",
    "Average_Order_Value",
    "Days_Since_Last_Purchase",
    "Discount_Usage_Rate",
    "Mobile_App_Usage",
]


class InsightQuery(BatchFilters):
    expected_fingerprint: Sha
    feature_key: FeatureKey | None = None


class InsightModel(StrictObject):
    task: Literal["classification", "segmentation"]
    model_version: str
    artifact_sha256: Sha
    metadata_sha256: Sha
    namespace: None = None
    registry_id: None = None
    unavailable_reason: Literal["not_exposed_by_source"] = "not_exposed_by_source"


class Unit(StrictObject):
    kind: str
    label: str
    verification_status: str


class ObservedValue(StrictObject):
    metric: str
    value: float | int | str | bool | None
    value_type: str
    unit: str
    cluster_id: int | None = None
    evidence_id: str


class DerivedValue(StrictObject):
    operation: Literal["subtract"]
    operands: list[str]
    value: float
    unit: str


class SampleCount(StrictObject):
    value: int | None
    unit: str
    scope: str
    evidence_id: str | None = None
    unavailable_reason: str | None = None


class Evidence(StrictObject):
    evidence_id: str
    source_field: str
    semantic_selector: dict[str, Any]
    observed_value: Any
    source_fingerprint: Sha


class Limitation(StrictObject):
    code: str
    description: str


class NavigationTarget(StrictObject):
    section: Literal[
        "purchase_distribution", "segment_distribution", "comparison", "results"
    ]
    feature_key: FeatureKey | None = None
    scope: Literal["same_applied_filters"] = "same_applied_filters"


class Insight(StrictObject):
    insight_id: Sha
    rule_id: str
    rule_version: str
    insight_type: Literal["observed_fact", "derived_comparison", "data_availability"]
    title: str
    description: str
    model_identity: InsightModel | None
    feature_key: FeatureKey | None = None
    unit: Unit | None = None
    observed_values: list[ObservedValue]
    derived_values: list[DerivedValue]
    sample_counts: list[SampleCount]
    evidence: list[Evidence]
    limitations: list[Limitation]
    navigation_target: NavigationTarget


class Evaluation(StrictObject):
    rule_id: str
    rule_version: str
    status: Literal["emitted", "skipped"]
    reason_code: str | None = None
    parameters: dict[str, Any]


class InsightEnvelope(StrictObject):
    contract_version: Literal["1.0.0"] = "1.0.0"
    rule_set_version: Literal["1.0.0"] = "1.0.0"
    precision_policy: Literal["significant-digits-12-v1"] = "significant-digits-12-v1"
    source: Literal["postgresql_f09_f10_saved_history"]
    as_of: datetime
    aggregate_fingerprint: Sha
    filter_scope: BatchFilters
    resolved_models: list[InsightModel]
    status: Literal["ready", "no_eligible_facts"]
    insights: list[Insight]
    evaluations: list[Evaluation]
