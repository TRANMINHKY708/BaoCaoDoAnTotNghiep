"""Additive v1 schemas. Existing legacy Pydantic models are not modified."""

from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, create_model, model_validator

from backend.schemas.customer import (
    BehaviorSnapshotCreate, CustomerUpdate, PredictionHistoryRead, SegmentationHistoryRead,
)
from src.data.dataset_contract import FIELDS
from src.training.xgboost_policy import MAIN_FEATURES
from src.segmentation.pipeline import FEATURES


Task = Literal["classification", "segmentation"]
_SPECS = {s.name: s for s in FIELDS}


class StrictObject(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


def customer_schema(name, features, nullable):
    fields = {}
    for n in features:
        spec = _SPECS[n]
        dtype = str if spec.kind == "text" else float
        if spec.categories:
            dtype = Literal[spec.categories]
        if nullable:
            dtype = dtype | None
        # Required key, nullable value only for research variants; no silent drops.
        opts = {"strict": True}
        if spec.categories:
            opts = {}
        if spec.kind == "text" and not spec.categories:
            opts["min_length"] = 1
            opts["pattern"] = r"\S"
        if not nullable and spec.kind != "text":
            if spec.minimum is not None:
                opts["ge"] = spec.minimum
            if spec.maximum is not None:
                opts["le"] = spec.maximum
        fields[n] = (Annotated[dtype, Field(**opts)], ...)
    return create_model(name, __base__=StrictObject, **fields)


LEGACY_FEATURES = tuple(s.name for s in FIELDS if s.name != "Total_Purchases")
LegacyPurchaseCustomer = customer_schema("LegacyPurchaseCustomer", LEGACY_FEATURES, False)
T4PurchaseCustomer = customer_schema("T4PurchaseCustomer", MAIN_FEATURES, True)
LegacySegmentCustomer = customer_schema("LegacySegmentCustomer", FEATURES, False)
T5SegmentCustomer = customer_schema("T5SegmentCustomer", FEATURES, True)


class Links(StrictObject):
    save_result: bool = False
    customer_id: UUID | None = None
    behavior_snapshot_id: UUID | None = None


class LegacyPurchaseRequest(Links):
    model_version: Literal["1.0.0"] = "1.0.0"
    customer: LegacyPurchaseCustomer
    explain: bool = Field(default=False, strict=True)


class T4PurchaseRequest(Links):
    model_version: Literal["2.0.0-snapshot-conservative12"]
    customer: T4PurchaseCustomer
    explain: bool = Field(default=False, strict=True)


class LegacySegmentRequest(Links):
    model_version: Literal["1.0.0"] = "1.0.0"
    customer: LegacySegmentCustomer


class T5SegmentRequest(Links):
    model_version: Literal["2.0.0-snapshot-k3"]
    customer: T5SegmentCustomer


PurchaseRequest = LegacyPurchaseRequest | T4PurchaseRequest
SegmentRequest = LegacySegmentRequest | T5SegmentRequest


class BatchLinks(StrictObject):
    save_results: bool = False
    customer_ids: list[UUID | None] | None = None
    behavior_snapshot_ids: list[UUID | None] | None = None

    @model_validator(mode="after")
    def aligned_links(self):
        for name in ("customer_ids", "behavior_snapshot_ids"):
            values = getattr(self, name)
            if values is not None and len(values) != len(self.customers):
                raise ValueError("Link counts must match customer count")
        return self


class LegacyPurchaseBatch(BatchLinks):
    model_version: Literal["1.0.0"] = "1.0.0"
    customers: list[LegacyPurchaseCustomer] = Field(min_length=1, max_length=100)


class T4PurchaseBatch(BatchLinks):
    model_version: Literal["2.0.0-snapshot-conservative12"]
    customers: list[T4PurchaseCustomer] = Field(min_length=1, max_length=100)


class LegacySegmentBatch(BatchLinks):
    model_version: Literal["1.0.0"] = "1.0.0"
    customers: list[LegacySegmentCustomer] = Field(min_length=1, max_length=100)


class T5SegmentBatch(BatchLinks):
    model_version: Literal["2.0.0-snapshot-k3"]
    customers: list[T5SegmentCustomer] = Field(min_length=1, max_length=100)


PurchaseBatch = LegacyPurchaseBatch | T4PurchaseBatch
SegmentBatch = LegacySegmentBatch | T5SegmentBatch


class ErrorDetail(StrictObject):
    location: list[str | int] = []
    code: str
    message: str


class ErrorBody(StrictObject):
    code: str
    message: str
    details: list[ErrorDetail] = []
    request_id: UUID


class ErrorEnvelope(StrictObject):
    error: ErrorBody


class Probabilities(StrictObject):
    Low: float = Field(ge=0, le=1)
    Medium: float = Field(ge=0, le=1)
    High: float = Field(ge=0, le=1)


class PurchaseResponse(StrictObject):
    task: Literal["classification"] = "classification"
    model_id: Literal["purchase-level-xgboost"] = "purchase-level-xgboost"
    model_version: str
    generated_at: datetime
    predicted_class: Literal[0, 1, 2]
    purchase_level: Literal["Low", "Medium", "High"]
    probabilities: Probabilities
    target_thresholds: dict[str, float]
    decision_rule: Literal["argmax_probability"] = "argmax_probability"
    scope: Literal["snapshot_classification_not_future_forecast"] = "snapshot_classification_not_future_forecast"


class ExplanationFeature(StrictObject):
    feature_name: str
    feature_value: float | None
    shap_value: float


class LocalExplanation(StrictObject):
    method: Literal["xgboost_native_exact_treeshap"]
    explanation_scope: Literal["local"]
    model_id: str
    model_version: str
    artifact_sha256: str
    input_source: Literal["request_payload"]
    input_values: dict[str, Any]
    feature_space: Literal["preprocessed"]
    predicted_class: Literal[0, 1, 2]
    purchase_level: Literal["Low", "Medium", "High"]
    output_space: Literal["raw_margin"]
    base_value: float
    model_output: float
    additivity_error: float
    features: list[ExplanationFeature]
    disclaimer: str


class ExplainedPurchaseResponse(PurchaseResponse):
    explanation: LocalExplanation


class SegmentResponse(StrictObject):
    task: Literal["segmentation"] = "segmentation"
    model_id: Literal["customer-segmentation-kmeans"] = "customer-segmentation-kmeans"
    model_version: str
    generated_at: datetime
    cluster: int = Field(ge=0, le=2)
    segment_id: str
    segment_name: str
    distance_to_centroid: float = Field(ge=0)
    distance_kind: Literal["standardized_euclidean_not_probability"] = "standardized_euclidean_not_probability"
    input_quality: dict[str, Any] | None = None
    scope: Literal["descriptive_snapshot_not_causal_or_future"] = "descriptive_snapshot_not_causal_or_future"


class PurchaseBatchResponse(StrictObject):
    total: int
    results: list[PurchaseResponse]


class SegmentBatchResponse(StrictObject):
    total: int
    results: list[SegmentResponse]


class ModelInfo(StrictObject):
    task: Task
    model_id: str
    model_version: str
    is_default: bool
    serving_mode: Literal["legacy_default", "explicit_research"]
    available: bool
    unavailable_code: str | None = None
    persistence_supported: bool
    artifact_sha256: str
    feature_count: int
    features: list[str]
    input_schema: dict[str, Any]
    label_namespace: str
    labels: dict[str, str]
    limitations: list[str]


class CatalogResponse(StrictObject):
    contract_version: Literal["1.0.0"] = "1.0.0"
    models: list[ModelInfo]


class HealthResponse(StrictObject):
    status: Literal["alive"] = "alive"
    contract_version: Literal["1.0.0"] = "1.0.0"


class ReadyResponse(StrictObject):
    status: Literal["ready"] = "ready"
    default_models_available: bool
    database_available: bool


class OverviewResponse(StrictObject):
    generated_at: datetime
    counts: dict[str, int]
    source: Literal["application_postgresql_not_research_dataset"] = "application_postgresql_not_research_dataset"


class SegmentsResponse(StrictObject):
    model_version: str
    definitions: dict[str, dict[str, str]]
    stored_result_counts: dict[str, int]
    count_unit: Literal["stored_segmentation_results_not_unique_customers"] = "stored_segmentation_results_not_unique_customers"
    scope: Literal["descriptive_snapshot"] = "descriptive_snapshot"


class CustomerUpdateV1(CustomerUpdate):
    @model_validator(mode="after")
    def no_explicit_null(self):
        if any(getattr(self, name) is None for name in self.model_fields_set):
            raise ValueError("Explicit null updates are forbidden; omit unchanged fields")
        return self


class BehaviorCreateV1(BehaviorSnapshotCreate):
    model_config = ConfigDict(allow_inf_nan=False)
    @model_validator(mode="after")
    def timezone_required(self):
        if self.captured_at is not None and self.captured_at.tzinfo is None:
            raise ValueError("captured_at must contain timezone when supplied")
        return self


class PredictionHistoryV1(PredictionHistoryRead):
    model_id: str
    model_registry_id: UUID
    model_name: str
    model_version: str
    predicted_class: Literal[0, 1, 2]
    purchase_level: Literal["Low", "Medium", "High"]


class SegmentHistoryV1(SegmentationHistoryRead):
    model_id: str
    model_registry_id: UUID
    model_name: str
    model_version: str
    segment_id: str


class PredictionHistoryPageV1(StrictObject):
    items: list[PredictionHistoryV1]
    total: int
    offset: int
    limit: int


class SegmentHistoryPageV1(StrictObject):
    items: list[SegmentHistoryV1]
    total: int
    offset: int
    limit: int
