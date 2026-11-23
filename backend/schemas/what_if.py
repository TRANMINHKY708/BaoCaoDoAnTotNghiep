"""Production T9 DTOs promoted from the approved T8 prototype.

WhatIf-prefixed names avoid collisions with existing OpenAPI schemas.
"""
from math import isclose
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StrictFloat, UUID4, field_validator, model_validator

from src.data.dataset_contract import FIELDS

CONTRACT_VERSION = "what-if-snapshot-v1"
MUTABLE = ("Login_Frequency", "Session_Duration_Avg", "Pages_Per_Session",
           "Wishlist_Items", "Email_Open_Rate", "Mobile_App_Usage")
MutableFeature = Literal["Login_Frequency", "Session_Duration_Avg", "Pages_Per_Session",
                         "Wishlist_Items", "Email_Open_Rate", "Mobile_App_Usage"]
T4_VERSION = "2.0.0-snapshot-conservative12"
T5_VERSION = "2.0.0-snapshot-k3"
T4_FEATURES = ("Age", "Gender", "Country", "City", "Membership_Years", "Login_Frequency",
               "Session_Duration_Avg", "Pages_Per_Session", "Wishlist_Items", "Email_Open_Rate",
               "Mobile_App_Usage", "Signup_Quarter")
SEGMENT_FEATURES = ("Login_Frequency", "Session_Duration_Avg", "Pages_Per_Session",
                    "Cart_Abandonment_Rate", "Wishlist_Items", "Total_Purchases",
                    "Average_Order_Value", "Days_Since_Last_Purchase", "Discount_Usage_Rate", "Mobile_App_Usage")
LEGACY_FEATURES = tuple(f.name for f in FIELDS if f.name != "Total_Purchases")
CLASS_ORDER = ("Low", "Medium", "High")
NON_CAUSAL = "Mô phỏng phản ứng của mô hình với input giả định; không phải tác động nhân quả hay dự báo giao dịch tương lai."
SHA = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
Number = Annotated[StrictFloat, Field(allow_inf_nan=False)]
Probability = Annotated[Number, Field(ge=0, le=1)]


class WhatIfStrictDTO(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class WhatIfModelSelection(WhatIfStrictDTO):
    classification: Literal["1.0.0", "2.0.0-snapshot-conservative12"]
    segmentation: Literal["1.0.0", "2.0.0-snapshot-k3"] | None = None


class WhatIfFeaturesBaseline(WhatIfStrictDTO):
    kind: Literal["features"]
    features: dict[str, Number | str | None]


class WhatIfCustomerBaseline(WhatIfStrictDTO):
    kind: Literal["customer"]
    customer_id: UUID
    snapshot_id: UUID | None = None


Baseline = Annotated[WhatIfFeaturesBaseline | WhatIfCustomerBaseline, Field(discriminator="kind")]


class WhatIfPreviewRequest(WhatIfStrictDTO):
    contract_version: Literal["what-if-snapshot-v1"]
    models: WhatIfModelSelection
    baseline: Baseline

    @model_validator(mode="after")
    def exact_feature_projection(self):
        if not isinstance(self.baseline, WhatIfFeaturesBaseline):
            return self
        selected = [(LEGACY_FEATURES if self.models.classification == "1.0.0" else T4_FEATURES,
                     self.models.classification != "1.0.0")]
        if self.models.segmentation:
            selected.append((SEGMENT_FEATURES, self.models.segmentation != "1.0.0"))
        expected = set().union(*(set(names) for names, _ in selected))
        values = self.baseline.features
        if set(values) != expected:
            raise ValueError("Baseline must contain exactly the selected model feature union")
        specs = {f.name: f for f in FIELDS}
        for names, nullable in selected:
            if all(values[n] is None for n in names):
                raise ValueError("Each selected model needs at least one observed value")
            if not nullable and any(values[n] is None for n in names):
                raise ValueError("Legacy inputs cannot contain null")
        for name, value in values.items():
            if value is None:
                continue
            spec = specs[name]
            if spec.kind == "text":
                if not isinstance(value, str) or not value.strip() or len(value) > 150:
                    raise ValueError("Expected nonblank categorical string of at most150 characters")
                if spec.categories and value not in spec.categories:
                    raise ValueError("Invalid category")
            else:
                if isinstance(value, str):
                    raise ValueError("Numeric strings are forbidden")
                if spec.minimum is not None and value < spec.minimum:
                    raise ValueError("Value below feature minimum")
                if spec.maximum is not None and value > spec.maximum:
                    raise ValueError("Value above feature maximum")
                if spec.kind == "binary" and value not in (0, 1):
                    raise ValueError("Expected numeric0/1")
        return self


class WhatIfCompareRequest(WhatIfPreviewRequest):
    changes: dict[MutableFeature, Number] = Field(max_length=6)
    expected_baseline_fingerprint: SHA | None = None

    @model_validator(mode="after")
    def mutable_ranges(self):
        for name, value in self.changes.items():
            if value < 0 or (name == "Email_Open_Rate" and value > 100):
                raise ValueError("Change outside allowed range")
        return self


class WhatIfSaveRequest(WhatIfCompareRequest):
    name: str = Field(min_length=1, max_length=200, pattern=r"\S")
    description: str | None = Field(default=None, max_length=1000)
    expected_comparison_fingerprint: SHA
    acknowledge_sensitive_snapshot_storage: Literal[True]
    # Idempotency-Key UUID header, policy authorization and DB checks are T9.

    @field_validator("acknowledge_sensitive_snapshot_storage", mode="before")
    @classmethod
    def explicit_ack(cls, value):
        if value is not True:
            raise ValueError("An explicit boolean true acknowledgement is required")
        return value


class WhatIfModelIdentity(WhatIfStrictDTO):
    model_id: Literal["purchase-level-xgboost", "customer-segmentation-kmeans"]
    model_version: str
    artifact_sha256: SHA
    metadata_sha256: SHA
    validation_policy: Literal["what-if-snapshot-v1"]

    @model_validator(mode="after")
    def version_belongs_to_task(self):
        versions = (("1.0.0", T4_VERSION) if self.model_id == "purchase-level-xgboost" else ("1.0.0", T5_VERSION))
        if self.model_version not in versions:
            raise ValueError("Unknown task-scoped version")
        return self


class WhatIfProbabilities(WhatIfStrictDTO):
    Low: Probability
    Medium: Probability
    High: Probability

    @model_validator(mode="after")
    def sum_is_one(self):
        if not isclose(sum(self.model_dump().values()), 1, abs_tol=1e-6, rel_tol=0):
            raise ValueError("Class probabilities must sum to one")
        return self


class WhatIfClassificationOutcome(WhatIfStrictDTO):
    task: Literal["classification"]
    model: WhatIfModelIdentity
    predicted_class: Literal[0, 1, 2]
    purchase_level: Literal["Low", "Medium", "High"]
    probabilities: WhatIfProbabilities
    decision_rule: Literal["argmax_probability"]
    target_thresholds: dict[Literal["low_inclusive", "medium_inclusive"], Number]

    @field_validator("predicted_class", mode="before")
    @classmethod
    def strict_class(cls, value):
        if type(value) is not int:
            raise ValueError("Class ID must be an integer, not bool/float/string")
        return value

    @model_validator(mode="after")
    def label_and_target(self):
        if isinstance(self.predicted_class, bool) or self.model.model_id != "purchase-level-xgboost":
            raise ValueError("Invalid class or model task")
        if self.purchase_level != CLASS_ORDER[self.predicted_class]:
            raise ValueError("Class and label mismatch")
        values = self.probabilities.model_dump()
        if max(CLASS_ORDER, key=values.get) != self.purchase_level:
            raise ValueError("Prediction must use fixed argmax order")
        if self.target_thresholds != {"low_inclusive": 10, "medium_inclusive": 15}:
            raise ValueError("Target thresholds remain10/15")
        return self


class WhatIfSegmentationOutcome(WhatIfStrictDTO):
    task: Literal["segmentation"]
    model: WhatIfModelIdentity
    cluster: Annotated[int, Field(strict=True, ge=0, le=2)]
    segment_id: str
    segment_name: str
    distance_to_centroid: Annotated[Number, Field(ge=0)]
    distance_kind: Literal["standardized_euclidean_not_probability"]

    @model_validator(mode="after")
    def namespace(self):
        if self.model.model_id != "customer-segmentation-kmeans":
            raise ValueError("Wrong segmentation model")
        if self.model.model_version == "1.0.0":
            expected_id = f"legacy:1.0.0:cluster:{self.cluster}"
            names = ("Khách hàng tích cực", "Khách hàng ít tương tác", "Khách hàng tiềm năng")
        else:
            expected_id = ("engagement_low", "engagement_medium", "engagement_high")[self.cluster]
            names = ("Tương tác thấp", "Tương tác trung bình", "Tương tác cao")
        if self.segment_id != expected_id or self.segment_name != names[self.cluster]:
            raise ValueError("Segment identity does not match task/version namespace")
        return self


Outcome = Annotated[WhatIfClassificationOutcome | WhatIfSegmentationOutcome, Field(discriminator="task")]


class WhatIfPreviewResponse(WhatIfStrictDTO):
    contract_version: Literal["what-if-snapshot-v1"]
    baseline_input: dict[str, Number | str | None]
    baseline_fingerprint: SHA
    classification: WhatIfClassificationOutcome
    segmentation: WhatIfSegmentationOutcome | None
    resolved_customer_id: UUID | None
    resolved_snapshot_id: UUID | None
    generated_at: AwareDatetime
    warnings: list[str]
    scope: Literal["snapshot_input_sensitivity_not_causal_or_future"]
    disclaimer: Literal[NON_CAUSAL]
    persisted: Literal[False]

    @model_validator(mode="after")
    def validated_baseline(self):
        if (self.resolved_customer_id is None) != (self.resolved_snapshot_id is None):
            raise ValueError("Resolved customer and snapshot must both be present or both absent")
        if self.generated_at.utcoffset().total_seconds() != 0:
            raise ValueError("Generated timestamp must be UTC")
        WhatIfPreviewRequest.model_validate({"contract_version": CONTRACT_VERSION,
            "models": {"classification": self.classification.model.model_version,
                       "segmentation": self.segmentation.model.model_version if self.segmentation else None},
            "baseline": {"kind": "features", "features": self.baseline_input}})
        return self


class WhatIfFeatureChange(WhatIfStrictDTO):
    feature: MutableFeature
    before: Number | None
    after: Number


class WhatIfClassDeltas(WhatIfStrictDTO):
    absolute: dict[Literal["Low", "Medium", "High"], Number]
    percentage_points: dict[Literal["Low", "Medium", "High"], Number]
    relative: dict[Literal["Low", "Medium", "High"], Number | None]

    @model_validator(mode="after")
    def exact_signed_class_maps(self):
        if any(set(values) != set(CLASS_ORDER) for values in (self.absolute, self.percentage_points, self.relative)):
            raise ValueError("All three class delta keys are required")
        if any(abs(v) > 1 for v in self.absolute.values()) or any(abs(v) > 100 for v in self.percentage_points.values()):
            raise ValueError("Probability deltas must use probability / percentage-point units")
        return self


class WhatIfComparisonResponse(WhatIfStrictDTO):
    contract_version: Literal["what-if-snapshot-v1"]
    baseline: WhatIfPreviewResponse
    scenario_input: dict[str, Number | str | None]
    scenario_classification: WhatIfClassificationOutcome
    scenario_segmentation: WhatIfSegmentationOutcome | None
    changed_fields: list[WhatIfFeatureChange] = Field(max_length=6)
    classification_label_changed: bool = Field(strict=True)
    probability_deltas: WhatIfClassDeltas
    comparison_fingerprint: SHA
    warnings: list[str]
    disclaimer: Literal[NON_CAUSAL]
    persisted: Literal[False]

    @model_validator(mode="after")
    def paired_models_and_deltas(self):
        base, scenario = self.baseline.classification, self.scenario_classification
        if base.model != scenario.model:
            raise ValueError("Baseline/scenario must use identical model pins/policy")
        if self.classification_label_changed != (base.purchase_level != scenario.purchase_level):
            raise ValueError("Incorrect class transition flag")
        names = [c.feature for c in self.changed_fields]
        if len(names) != len(set(names)) or set(self.scenario_input) != set(self.baseline.baseline_input):
            raise ValueError("Duplicate changes or unequal input keys")
        actual = {n for n in self.scenario_input if self.scenario_input[n] != self.baseline.baseline_input[n]}
        if actual != set(names):
            raise ValueError("Changed fields must exactly explain differing raw inputs")
        for change in self.changed_fields:
            if change.before != self.baseline.baseline_input[change.feature] or change.after != self.scenario_input[change.feature]:
                raise ValueError("Incorrect before/after input")
            if change.after < 0 or (change.feature == "Email_Open_Rate" and change.after > 100):
                raise ValueError("Invalid changed value")
        WhatIfPreviewRequest.model_validate({"contract_version": CONTRACT_VERSION,
            "models": {"classification": scenario.model.model_version,
                       "segmentation": self.scenario_segmentation.model.model_version if self.scenario_segmentation else None},
            "baseline": {"kind": "features", "features": self.scenario_input}})
        old_segment, new_segment = self.baseline.segmentation, self.scenario_segmentation
        if (old_segment is None) != (new_segment is None):
            raise ValueError("Segmentation must be present on both sides or neither")
        if old_segment and old_segment.model != new_segment.model:
            raise ValueError("Segmentation pins must match")
        before, after = base.probabilities.model_dump(), scenario.probabilities.model_dump()
        deltas = self.probability_deltas
        if any(set(values) != set(CLASS_ORDER) for values in (deltas.absolute, deltas.percentage_points, deltas.relative)):
            raise ValueError("All three class deltas are required")
        for label in CLASS_ORDER:
            delta = after[label] - before[label]
            if not isclose(deltas.absolute[label], delta, abs_tol=1e-9, rel_tol=0) or not isclose(deltas.percentage_points[label], delta * 100, abs_tol=1e-7, rel_tol=0):
                raise ValueError("Delta is after minus before, not a causal effect")
            relative = deltas.relative[label]
            if before[label] <= 1e-12:
                if relative is not None:
                    raise ValueError("Undefined relative delta must be null")
            elif relative is None or not isclose(relative, delta / before[label], abs_tol=1e-9, rel_tol=1e-9):
                raise ValueError("Incorrect relative delta")
        return self


class WhatIfStoredResultEnvelope(WhatIfStrictDTO):
    schema_version: Literal["what-if-snapshot-v1"]
    input_features: dict[str, Number | str | None]
    input_sha256: SHA
    prediction: Outcome
    interpretation: Literal["snapshot_non_causal"]

    @model_validator(mode="after")
    def exact_task_projection(self):
        prediction = self.prediction
        if prediction.task == "classification":
            WhatIfPreviewRequest.model_validate({"contract_version": CONTRACT_VERSION,
                "models": {"classification": prediction.model.model_version},
                "baseline": {"kind": "features", "features": self.input_features}})
        else:
            if set(self.input_features) != set(SEGMENT_FEATURES):
                raise ValueError("Expected exact segmentation projection")
            for name, value in self.input_features.items():
                if value is None and prediction.model.model_version != "1.0.0":
                    continue
                if value is None or isinstance(value, str) or value < 0:
                    raise ValueError("Invalid segmentation value")
                if name in {"Cart_Abandonment_Rate", "Discount_Usage_Rate"} and value > 100:
                    raise ValueError("Invalid segmentation rate")
            if all(v is None for v in self.input_features.values()):
                raise ValueError("All-null segmentation input is forbidden")
        return self


class WhatIfPinSet(WhatIfStrictDTO):
    classification: WhatIfModelIdentity
    segmentation: WhatIfModelIdentity | None

    @model_validator(mode="after")
    def distinct_tasks(self):
        if self.classification.model_id != "purchase-level-xgboost" or (self.segmentation and self.segmentation.model_id != "customer-segmentation-kmeans"):
            raise ValueError("Each pin must belong to its named task")
        return self


class WhatIfStoredSource(WhatIfStrictDTO):
    kind: Literal["customer", "features"]
    original_customer_id: UUID | None
    original_snapshot_id: UUID | None

    @model_validator(mode="after")
    def source_links(self):
        expected = self.kind == "customer"
        if (self.original_customer_id is not None) != expected or (self.original_snapshot_id is not None) != expected:
            raise ValueError("Source IDs must match baseline mode")
        return self


class WhatIfIdempotencyEnvelope(WhatIfStrictDTO):
    scope: Literal["local-demo-single-owner-v1"]
    key: UUID4
    canonical_intent_sha256: SHA


class WhatIfStorageAcknowledgement(WhatIfStrictDTO):
    sensitive_snapshot_storage: Literal[True]

    @field_validator("sensitive_snapshot_storage", mode="before")
    @classmethod
    def explicit_ack(cls, value):
        if value is not True:
            raise ValueError("Explicit boolean true required")
        return value


class WhatIfStoredComputationAudit(WhatIfStrictDTO):
    baseline_generated_at: AwareDatetime
    baseline_warnings: list[str]
    comparison_warnings: list[str]
    scope: Literal["snapshot_input_sensitivity_not_causal_or_future"]

    @field_validator("baseline_generated_at")
    @classmethod
    def utc(cls, value):
        if value.utcoffset().total_seconds() != 0:
            raise ValueError("Computation timestamp must be UTC")
        return value


class WhatIfStoredChangesEnvelope(WhatIfStrictDTO):
    schema_version: Literal["what-if-snapshot-v1"]
    canonicalization: Literal["what-if-canonical-json-v1"]
    source: WhatIfStoredSource
    baseline_fingerprint: SHA
    comparison_fingerprint: SHA
    models: WhatIfPinSet
    changes: list[WhatIfFeatureChange] = Field(max_length=6)
    requested_changes: dict[MutableFeature, Number] = Field(max_length=6)
    idempotency: WhatIfIdempotencyEnvelope
    acknowledgement: WhatIfStorageAcknowledgement
    audit: WhatIfStoredComputationAudit
    interpretation: Literal["snapshot_non_causal"]

    @model_validator(mode="after")
    def legacy_policy_and_changes(self):
        if self.models.classification.model_version != "1.0.0" or (self.models.segmentation and self.models.segmentation.model_version != "1.0.0"):
            raise ValueError("Research persistence remains forbidden")
        names = [change.feature for change in self.changes]
        if len(names) != len(set(names)):
            raise ValueError("Duplicate effective changes")
        for name, value in self.requested_changes.items():
            if value < 0 or (name == "Email_Open_Rate" and value > 100):
                raise ValueError("Invalid requested change")
        for change in self.changes:
            if change.feature not in self.requested_changes or change.after != self.requested_changes[change.feature] or change.before == change.after:
                raise ValueError("Effective changes must agree with requested set assignments")
        return self


class WhatIfStoredClassificationDeltas(WhatIfClassDeltas):
    schema_version: Literal["what-if-snapshot-v1"]
    task: Literal["classification"]
    supported: Literal[True]
    warnings: list[str]
    class_changed: bool = Field(strict=True)
    comparison_fingerprint: SHA


class WhatIfStoredSegmentationDeltas(WhatIfStrictDTO):
    schema_version: Literal["what-if-snapshot-v1"]
    task: Literal["segmentation"]
    supported: Literal[False]
    reason: Literal["kmeans_distance_is_not_probability"]
    baseline_segment_id: str
    scenario_segment_id: str
    segment_changed: bool = Field(strict=True)
    warnings: list[str]
    comparison_fingerprint: SHA


class WhatIfStoredResultReference(WhatIfStrictDTO):
    scenario_result_id: UUID
    task: Literal["classification", "segmentation"]
    model_registry_id: UUID
    model_identity: WhatIfModelIdentity


class WhatIfSavedScenarioDetail(WhatIfStrictDTO):
    contract_version: Literal["what-if-snapshot-v1"]
    scenario_id: UUID
    created_at: AwareDatetime
    persisted: Literal[True]
    idempotency_replayed: bool = Field(strict=True)
    original_customer_id: UUID | None
    original_snapshot_id: UUID | None
    current_customer_id: UUID | None
    current_snapshot_id: UUID | None
    source_link_status: Literal["attached", "detached", "features_only"]
    name: str = Field(min_length=1, max_length=200)
    description: str | None
    comparison: WhatIfComparisonResponse
    results: list[WhatIfStoredResultReference] = Field(min_length=1, max_length=2)
    disclaimer: Literal[NON_CAUSAL]
    integrity_status: Literal["verified"]

    @model_validator(mode="after")
    def saved_references(self):
        expected = {"classification": self.comparison.baseline.classification.model}
        if self.comparison.baseline.segmentation:
            expected["segmentation"] = self.comparison.baseline.segmentation.model
        if len(self.results) != len(expected) or {r.task for r in self.results} != set(expected):
            raise ValueError("Exactly one result per selected task is required")
        if any(r.model_identity != expected[r.task] or r.model_identity.model_version != "1.0.0" for r in self.results):
            raise ValueError("Legacy-only saved model identities must match comparison")
        if len({r.scenario_result_id for r in self.results}) != len(self.results):
            raise ValueError("Result identities must be distinct")
        if self.created_at.utcoffset().total_seconds() != 0:
            raise ValueError("Stored timestamp must be UTC")
        original = (self.original_customer_id, self.original_snapshot_id)
        current = (self.current_customer_id, self.current_snapshot_id)
        if (original[0] is None) != (original[1] is None):
            raise ValueError("Original source IDs must be paired")
        expected_status = "features_only" if original == (None, None) else "attached" if current == original else "detached"
        if any(now is not None and now != old for now, old in zip(current, original)) or self.source_link_status != expected_status:
            raise ValueError("Current links may detach, not change to a different source")
        return self


class WhatIfHistorySummary(WhatIfStrictDTO):
    scenario_id: UUID
    name: str
    created_at: AwareDatetime
    customer_id: UUID | None
    models: WhatIfModelSelection | None
    baseline_label: Literal["Low", "Medium", "High"] | None
    scenario_label: Literal["Low", "Medium", "High"] | None
    classification_label_changed: bool | None
    scope: Literal["snapshot_input_sensitivity_not_causal_or_future"]
    integrity_status: Literal["verified", "unverified"]

    @model_validator(mode="after")
    def unverified_has_no_interpreted_outputs(self):
        if self.integrity_status == "unverified" and any(v is not None for v in (self.models, self.baseline_label, self.scenario_label, self.classification_label_changed)):
            raise ValueError("Do not invent interpretation for unsupported stored JSON")
        if self.created_at.utcoffset().total_seconds() != 0:
            raise ValueError("History timestamp must be UTC")
        return self


class WhatIfHistoryPage(WhatIfStrictDTO):
    items: list[WhatIfHistorySummary]
    total: Annotated[int, Field(strict=True, ge=0)]
    offset: Annotated[int, Field(strict=True, ge=0)]
    limit: Annotated[int, Field(strict=True, ge=1, le=100)]
    disclaimer: Literal[NON_CAUSAL]

    @model_validator(mode="after")
    def page_size(self):
        if len(self.items) > self.limit or len(self.items) > self.total:
            raise ValueError("Page counters disagree with items")
        return self


class WhatIfHistoryQuery(WhatIfStrictDTO):
    customer_id: UUID | None = None
    classification_model_version: Literal["1.0.0", "2.0.0-snapshot-conservative12"] | None = None
    offset: Annotated[int, Field(strict=True, ge=0)] = 0
    limit: Annotated[int, Field(strict=True, ge=1, le=100)] = 20


SCHEMA_TYPES = (WhatIfPreviewRequest, WhatIfCompareRequest, WhatIfSaveRequest, WhatIfPreviewResponse,
                WhatIfComparisonResponse, WhatIfStoredResultEnvelope, WhatIfStoredChangesEnvelope,
                WhatIfStoredClassificationDeltas, WhatIfStoredSegmentationDeltas, WhatIfSavedScenarioDetail,
                WhatIfHistoryQuery, WhatIfHistoryPage)


# Python aliases retain T8 vocabulary; OpenAPI names remain task-specific.
StoredClassificationDeltas = WhatIfStoredClassificationDeltas
StoredSegmentationDeltas = WhatIfStoredSegmentationDeltas
StorageAcknowledgement = WhatIfStorageAcknowledgement
StoredComputationAudit = WhatIfStoredComputationAudit
ClassificationOutcome = WhatIfClassificationOutcome
StoredChangesEnvelope = WhatIfStoredChangesEnvelope
StoredResultReference = WhatIfStoredResultReference
StoredResultEnvelope = WhatIfStoredResultEnvelope
SegmentationOutcome = WhatIfSegmentationOutcome
IdempotencyEnvelope = WhatIfIdempotencyEnvelope
SavedScenarioDetail = WhatIfSavedScenarioDetail
ComparisonResponse = WhatIfComparisonResponse
FeaturesBaseline = WhatIfFeaturesBaseline
CustomerBaseline = WhatIfCustomerBaseline
PreviewResponse = WhatIfPreviewResponse
ModelSelection = WhatIfModelSelection
PreviewRequest = WhatIfPreviewRequest
CompareRequest = WhatIfCompareRequest
HistorySummary = WhatIfHistorySummary
ModelIdentity = WhatIfModelIdentity
Probabilities = WhatIfProbabilities
FeatureChange = WhatIfFeatureChange
StoredSource = WhatIfStoredSource
HistoryQuery = WhatIfHistoryQuery
SaveRequest = WhatIfSaveRequest
ClassDeltas = WhatIfClassDeltas
HistoryPage = WhatIfHistoryPage
StrictDTO = WhatIfStrictDTO
PinSet = WhatIfPinSet
