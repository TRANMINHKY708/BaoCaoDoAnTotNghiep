"""Runtime DTO validation and the approved, prefixed OpenAPI schema bundle."""
import json
from copy import deepcopy
from datetime import date, timedelta
from math import isclose
from pathlib import Path
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

CONTRACT = json.loads((Path(__file__).resolve().parents[2] /
    "docs/contracts/t12_dashboard_openapi.draft.json").read_text(encoding="utf-8"))
PATH = "/api/v1/dashboard/overview"
# Approved additive extension; keep the historical T12 draft unchanged.
CONTRACT["components"]["schemas"]["DashboardOverview"]["properties"]["filters"]["properties"]["timezone"] = {
    "type": "string", "enum": ["UTC", "Asia/Ho_Chi_Minh"]
}
CONTRACT["paths"][PATH]["get"]["parameters"].append({
    "name": "timezone", "in": "query", "required": False,
    "description": "Calendar timezone for date bounds and daily buckets. Defaults to UTC for existing clients.",
    "schema": {"type": "string", "enum": ["UTC", "Asia/Ho_Chi_Minh"], "default": "UTC"},
})
for parameter in CONTRACT["paths"][PATH]["get"]["parameters"]:
    if parameter["name"] in {"date_from", "date_to"}:
        parameter["description"] = parameter["description"].replace("UTC", "in the selected timezone")

Count = Annotated[int, Field(strict=True, ge=0)]
Share = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
VersionC = Literal["1.0.0", "2.0.0-snapshot-conservative12"]
VersionS = Literal["1.0.0", "2.0.0-snapshot-k3"]
Segment = Literal["legacy:1.0.0:cluster:0", "legacy:1.0.0:cluster:1", "legacy:1.0.0:cluster:2",
                  "engagement_low", "engagement_medium", "engagement_high"]
Label = Annotated[str, Field(min_length=1, max_length=150)]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Records(Strict):
    total: Count
    linked: Count
    unlinked: Count
    excluded_unlinked: Count


class Coverage(Strict):
    with_result: Count
    without_result: Count


class Model(Strict):
    task: Literal["classification", "segmentation"]
    model_id: Literal["purchase-level-xgboost", "customer-segmentation-kmeans"]
    model_version: VersionC | VersionS
    artifact_sha256: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
    available_for_inference: bool
    persistence_supported: bool


class Probabilities(Strict):
    Low: Share
    Medium: Share
    High: Share


class Purchase(Strict):
    purchase_level: Literal["Low", "Medium", "High"]
    customers: Count
    share: Share | None


class SegmentCount(Strict):
    cluster: Literal[0, 1, 2]
    segment_id: Segment
    display_label: Label | None
    customers: Count
    share: Share | None


class Classification(Strict):
    model: Model
    stored_results: Records
    customers: Coverage
    distribution: tuple[Purchase, Purchase, Purchase]
    mean_probabilities: Probabilities | None
    latest_result_at: AwareDatetime | None


class Segmentation(Strict):
    model: Model
    stored_results: Records
    customers: Coverage
    distribution: tuple[SegmentCount, SegmentCount, SegmentCount]
    latest_result_at: AwareDatetime | None


class Filters(Strict):
    date_from: date
    date_to: date
    window_start: AwareDatetime
    window_end: AwareDatetime
    timezone: Literal["UTC", "Asia/Ho_Chi_Minh"]
    classification_model_version: VersionC
    segmentation_model_version: VersionS
    segment_id: Segment | None


class Totals(Strict):
    filter_scope: Literal["all_workspace_as_of_not_filtered"]
    customers: Count
    active_customers: Count
    behavior_snapshots: Count
    registered_models: Count


class Cohort(Strict):
    customers: Count
    include_inactive: Literal[True]
    selection_rule: Literal["all_current_customers", "latest_linked_segmentation_in_window"]


class WhatIf(Strict):
    scenarios: Count
    scenario_results: Count
    excluded_unlinked_scenarios: Count
    filter_scope: Literal["window_and_cohort_not_model_selectors"]
    integrity: Literal["counts_only_not_verified"]
    latest_scenario_at: AwareDatetime | None


class Day(Strict):
    date: date
    purchase_results: Count
    segmentation_results: Count
    what_if_scenarios: Count
    is_partial: bool


class PurchasePreview(Strict):
    purchase_level: Literal["Low", "Medium", "High"]
    created_at: AwareDatetime


class SegmentPreview(Strict):
    segment_id: Segment
    display_label: Label | None
    created_at: AwareDatetime


class CustomerPreview(Strict):
    id: UUID
    external_id: Annotated[str, Field(min_length=1, max_length=100)]
    is_active: bool
    created_at: AwareDatetime
    purchase_in_window: PurchasePreview | None
    segment_in_window: SegmentPreview | None


class Recent(Strict):
    selection_rule: Literal["cohort_customer_created_at_desc_id_desc"]
    limit: Annotated[int, Field(ge=1, le=20)]
    cohort_total: Count
    items: Annotated[list[CustomerPreview], Field(max_length=20)]


class Thresholds(Strict):
    low_inclusive: Literal[10]
    medium_inclusive: Literal[15]


class DashboardOverview(Strict):
    contract_version: Literal["dashboard-snapshot-v1"]
    generated_at: AwareDatetime
    as_of: AwareDatetime
    source: Literal["application_postgresql_not_research_dataset"]
    scope: Literal["stored_snapshot_analysis_not_causal_or_future"]
    purchase_level_source: Literal["stored_model_prediction_not_ground_truth"]
    target_thresholds: Thresholds
    filters: Filters
    workspace_totals: Totals
    cohort: Cohort
    classification: Classification
    segmentation: Segmentation
    what_if: WhatIf
    activity_by_day: Annotated[list[Day], Field(min_length=1, max_length=366)]
    recent_customers: Recent
    warnings: Annotated[list[str], Field(max_length=8)]

    @model_validator(mode="after")
    def invariants(self):
        from backend.services.dashboard import CLASS_ORDER, segment_ids
        def require(condition):
            if not condition:
                raise ValueError("Dashboard cross-field integrity violation")
        ids = segment_ids(self.filters.segmentation_model_version)
        require([d.purchase_level for d in self.classification.distribution] == CLASS_ORDER)
        require([d.cluster for d in self.segmentation.distribution] == [0, 1, 2])
        require([d.segment_id for d in self.segmentation.distribution] == ids)
        for task in ("classification", "segmentation"):
            p = getattr(self, task)
            require(p.model.task == task)
            require(p.model.model_id == ("purchase-level-xgboost" if task == "classification" else "customer-segmentation-kmeans"))
            require(p.model.model_version == getattr(self.filters, f"{task}_model_version"))
            require(p.model.persistence_supported == (p.model.model_version == "1.0.0"))
            require(p.customers.with_result + p.customers.without_result == self.cohort.customers)
            require(sum(d.customers for d in p.distribution) == p.customers.with_result)
            require(p.stored_results.total == p.stored_results.linked + p.stored_results.unlinked)
            require(p.customers.with_result <= p.stored_results.linked)
            require((p.latest_result_at is None) == (p.stored_results.total == 0))
            for d in p.distribution:
                require((d.share is None) == (p.customers.with_result == 0))
                if d.share is not None:
                    require(isclose(d.share, d.customers / p.customers.with_result, abs_tol=1e-12))
            if self.filters.segment_id is not None:
                require(p.stored_results.unlinked == 0)
            else:
                require(p.stored_results.excluded_unlinked == 0)
        means = self.classification.mean_probabilities
        require((means is None) == (self.classification.customers.with_result == 0))
        if means:
            require(isclose(sum(means.model_dump().values()), 1, abs_tol=1e-6, rel_tol=0))
        require(sum(d.purchase_results for d in self.activity_by_day) == self.classification.stored_results.total)
        require(sum(d.segmentation_results for d in self.activity_by_day) == self.segmentation.stored_results.total)
        require(sum(d.what_if_scenarios for d in self.activity_by_day) == self.what_if.scenarios)
        require(self.recent_customers.cohort_total == self.cohort.customers)
        require(len(self.recent_customers.items) == min(self.recent_customers.limit, self.cohort.customers))
        require(self.workspace_totals.active_customers <= self.workspace_totals.customers)
        require([d.date for d in self.activity_by_day] == [self.filters.date_from + timedelta(days=i)
                for i in range((self.filters.date_to - self.filters.date_from).days)])
        require(self.filters.window_start <= self.filters.window_end <= self.as_of)
        require(len({c.id for c in self.recent_customers.items}) == len(self.recent_customers.items))
        for item in self.recent_customers.items:
            for label in (item.purchase_in_window, item.segment_in_window):
                if label is not None:
                    require(self.filters.window_start <= label.created_at < self.filters.window_end)
            if item.segment_in_window:
                require(item.segment_in_window.segment_id in ids)
        allowed = CONTRACT["components"]["schemas"]["DashboardOverview"]["properties"]["warnings"]["items"]["enum"]
        require(len(set(self.warnings)) == len(self.warnings) and set(self.warnings) <= set(allowed))
        return self


def install_openapi(app):
    """Publish exact approved new schemas, leaving all old operations untouched.

    Runtime validates with the DTO above, then response JSON uses this single
    approved wire schema. The draft's external error refs become local refs.
    """
    original = app.openapi

    def generate():
        spec = original()
        spec["components"]["schemas"].update(deepcopy(CONTRACT["components"]["schemas"]))
        current = spec["paths"][PATH]["get"]
        operation = deepcopy(CONTRACT["paths"][PATH]["get"])
        operation.pop("security", None)
        for status, response in operation["responses"].items():
            if status != "200":
                response["content"]["application/json"]["schema"] = {"$ref": "#/components/schemas/ErrorEnvelope"}
        if app.state.settings.security_profile == "secured":
            operation["security"] = current.get("security", [{"WorkspaceBearer": []}])
            operation["x-workspace-access"] = "viewer_or_operator_no_save"
            for code, response in current["responses"].items():
                operation["responses"].setdefault(code, response)
        spec["paths"][PATH]["get"] = operation
        return spec

    app.openapi = generate
