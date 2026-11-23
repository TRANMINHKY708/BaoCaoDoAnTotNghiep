"""Research-only response, separate from stored segmentation counts."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class FeatureStats(Strict):
    mean: float | None
    observed_count: int


class Notable(Strict):
    feature: str
    cluster_mean: float
    overall_mean: float
    difference: float
    standardized_difference: float


class ClusterProfile(Strict):
    cluster_id: int
    record_count: int
    share_percent: float | None
    status: str
    features: dict[str, FeatureStats]
    notable_features: list[Notable]


class ResearchProfiles(Strict):
    source: Literal["cleaned_research_dataset"]
    source_name: str
    dataset_sha256: str
    model_id: Literal["customer-segmentation-kmeans"]
    model_version: str
    artifact_sha256: str
    computed_at: datetime
    count_unit: Literal["research_records_not_unique_application_customers"]
    statistics_space: str
    minimum_observed_per_mean: int
    total_records: int
    records_used: int
    actual_cluster_count: int
    configured_cluster_count: int
    status: str
    feature_names: list[str]
    overall: dict[str, FeatureStats]
    clusters: list[ClusterProfile]
    disclaimer: str
