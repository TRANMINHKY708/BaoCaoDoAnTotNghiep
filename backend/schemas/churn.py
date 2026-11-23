"""K5 churn API schemas. Separate from the purchase/segment v1 schemas so their contract is unchanged.

The input never contains `Churned` (extra fields are forbidden) nor the excluded history-derived
fields (`Lifetime_Value`, `Total_Purchases`, `Days_Since_Last_Purchase`).
"""

from datetime import datetime
from typing import Literal

from pydantic import Field

from backend.schemas.v1 import StrictObject, customer_schema
from src.training.churn_policy import MAIN_FEATURES

MODEL_ID = "customer-churn-xgboost"
MAX_BATCH = 100

ChurnCustomer = customer_schema("ChurnCustomer", MAIN_FEATURES, True)

RiskLevel = Literal["low", "medium", "high"]


class ChurnPredictRequest(StrictObject):
    customer: ChurnCustomer
    explain: bool = Field(default=False, strict=True)


class ChurnBatchRequest(StrictObject):
    customers: list[ChurnCustomer] = Field(min_length=1, max_length=MAX_BATCH)


class RiskThresholds(StrictObject):
    low_below: float = Field(gt=0, lt=1)
    high_from: float = Field(gt=0, lt=1)


class ChurnFactor(StrictObject):
    feature: str
    value: str | float | None
    shap_value: float
    direction: Literal["increases_risk", "decreases_risk"]


class ChurnExplanation(StrictObject):
    method: Literal["xgboost_native_exact_treeshap"] = "xgboost_native_exact_treeshap"
    output_space: Literal["log_odds"] = "log_odds"
    feature_space: Literal["source_features"] = "source_features"
    base_value: float
    model_output: float
    additivity_error: float
    factors: list[ChurnFactor]
    disclaimer: str


class ChurnPrediction(StrictObject):
    task: Literal["churn"] = "churn"
    model_id: Literal["customer-churn-xgboost"] = MODEL_ID
    model_version: str
    generated_at: datetime
    churn_probability: float = Field(ge=0, le=1)
    risk_level: RiskLevel
    predicted_churn: bool
    decision_threshold: float = Field(gt=0, lt=1)
    risk_thresholds: RiskThresholds
    scope: Literal["snapshot_churn_status_not_time_to_churn"] = "snapshot_churn_status_not_time_to_churn"


class ExplainedChurnPrediction(ChurnPrediction):
    explanation: ChurnExplanation


class ChurnBatchResponse(StrictObject):
    total: int = Field(ge=1, le=MAX_BATCH)
    results: list[ChurnPrediction]


class HoldoutMetrics(StrictObject):
    rows: int
    churn_rate: float
    roc_auc: float
    pr_auc: float
    f1: float
    precision: float
    recall: float
    brier: float
    ece: float
    scored_at: datetime


class ChurnModelInfo(StrictObject):
    model_id: Literal["customer-churn-xgboost"] = MODEL_ID
    model_version: str
    feature_policy: str
    algorithm: Literal["XGBoost"] = "XGBoost"
    available: bool
    unavailable_code: str | None
    artifact_sha256: str
    feature_count: int
    features: list[str]
    excluded_features: list[str]
    decision_threshold: float
    risk_thresholds: RiskThresholds
    holdout: HoldoutMetrics
    persistence_supported: Literal[False] = False
    max_batch_size: int = MAX_BATCH
    limitations: list[str]
