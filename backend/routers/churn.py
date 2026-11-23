"""K5 churn endpoints under /api/v1/churn. Inference only: nothing is written to the database."""

from typing import Annotated

from fastapi import APIRouter, Body

from backend.demo_data import DEMO_XGBOOST_CUSTOMER
from backend.schemas import churn as s
from backend.schemas.v1 import ErrorEnvelope
from backend.services.churn_model import churn_model

ERRORS = {n: {"model": ErrorEnvelope} for n in (422, 503)}
router = APIRouter(prefix="/api/v1/churn", tags=["API v1 — churn"], responses=ERRORS)
EXAMPLE_CUSTOMER = {name: DEMO_XGBOOST_CUSTOMER.get(name) for name in s.ChurnCustomer.model_fields}
PREDICT_EXAMPLES = {
    "basic": {"summary": "One snapshot, probability and risk level", "value": {"customer": EXAMPLE_CUSTOMER}},
    "explain": {"summary": "With per-feature SHAP factors", "value": {"customer": EXAMPLE_CUSTOMER, "explain": True}},
}


@router.get("/model", response_model=s.ChurnModelInfo)
def churn_model_info():
    """Pinned churn model: version, features, thresholds, one-shot holdout metrics and limitations."""
    return churn_model.info()


@router.post("/predict", response_model=s.ChurnPrediction | s.ExplainedChurnPrediction)
def churn_predict(payload: Annotated[s.ChurnPredictRequest, Body(openapi_examples=PREDICT_EXAMPLES)]):
    """Churn probability of the current snapshot, not the time until a customer leaves."""
    return churn_model.predict(payload.customer.model_dump(), explain=payload.explain)


@router.post("/predict/batch", response_model=s.ChurnBatchResponse)
def churn_predict_batch(payload: s.ChurnBatchRequest):
    """Up to 100 snapshots in one call; no explanation, no persistence."""
    results = [churn_model.predict(customer.model_dump()) for customer in payload.customers]
    return {"total": len(results), "results": results}
