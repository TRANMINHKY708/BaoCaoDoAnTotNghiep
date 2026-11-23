"""Additive, typed /api/v1 contract. Legacy routers remain unchanged."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Body, Depends, File, Form, Header, Query, Request, Response, UploadFile
from sqlalchemy.orm import Session

from backend.db.session import get_db, get_optional_db, check_database_connection
from backend.demo_data import DEMO_XGBOOST_CUSTOMER, DEMO_KMEANS_CUSTOMER
from backend.schemas import v1 as s
from backend.schemas.segment_profiles import ResearchProfiles
from backend.schemas.customer import (
    CustomerCreate, CustomerRead, CustomerPage, BehaviorSnapshotRead, BehaviorSnapshotPage,
)
from backend.services import customer_service, v1_data
from backend.services.customer_concurrency import customer_etag
from backend.services.persistence_service import persist_inference_results
from backend.services.versioned_models import (
    ensure_persistence_allowed, failure, infer, validate_registry_identity, versioned_models,
)


ERRORS = {n: {"model": s.ErrorEnvelope} for n in (404, 409, 413, 422, 500, 503)}
router = APIRouter(prefix="/api/v1", tags=["API v1 — snapshot"], responses=ERRORS)
PURCHASE_EXAMPLES = {
    "legacy": {"summary": "Default legacy: 24 features", "value": {"model_version": "1.0.0", "customer": DEMO_XGBOOST_CUSTOMER}},
    "t4": {"summary": "Explicit T4: 12 features, inference only", "value": {
        "model_version": "2.0.0-snapshot-conservative12", "save_result": False,
        "customer": {n: DEMO_XGBOOST_CUSTOMER[n] for n in s.T4PurchaseCustomer.model_fields}}},
}
SEGMENT_EXAMPLES = {
    "legacy": {"summary": "Legacy cluster IDs and labels", "value": {"model_version": "1.0.0", "customer": DEMO_KMEANS_CUSTOMER}},
    "t5": {"summary": "Explicit T5 engagement IDs; distance is not confidence", "value": {
        "model_version": "2.0.0-snapshot-k3", "save_result": False, "customer": DEMO_KMEANS_CUSTOMER}},
}


def save(db, task, version, requested, inputs, results, run_type, customer_ids=None, snapshot_ids=None):
    ensure_persistence_allowed(task, version, requested)
    if not requested:
        return
    if db is None:
        failure(503, "DATABASE_UNAVAILABLE", "Database persistence is not configured")
    validate_registry_identity(db, task)
    persist_inference_results(db, task=task, run_type=run_type, inputs=inputs, results=results,
                              customer_ids=customer_ids, snapshot_ids=snapshot_ids)


@router.get("/health", response_model=s.HealthResponse)
def health():
    """Process liveness, not model/DB readiness or research validity."""
    return {}


@router.get("/ready", response_model=s.ReadyResponse)
def ready(request: Request):
    """Full-app readiness requires both pinned legacy defaults and PostgreSQL."""
    models = all(versioned_models.entries.get((task, "1.0.0"), {}).get("pipeline") is not None for task in ("classification", "segmentation"))
    try:
        database = check_database_connection(request.app.state.settings.database_url) if request.app.state.settings.security_profile == "accounts" else check_database_connection()
    except Exception:
        database = False
    if not (models and database):
        failure(503, "NOT_READY", "Default models or application database are unavailable")
    return {"default_models_available": models, "database_available": database}


@router.get("/model-info", response_model=s.CatalogResponse)
def catalog():
    """API version != model version. Explicit research availability is not promotion."""
    return versioned_models.catalog()


@router.get("/overview", response_model=s.OverviewResponse)
def overview(db: Session = Depends(get_db)):
    return v1_data.overview(db)


@router.get("/segments", response_model=s.SegmentsResponse | ResearchProfiles)
def segments(model_version: str = Query("1.0.0", max_length=50), db: Session = Depends(get_db), research_profiles: bool = Query(False)):
    """Stored counts by default; opt-in research profiles never query the session."""
    if research_profiles:
        from backend.services.segmentation_profiles import research_profiles as compute_profiles
        return compute_profiles(model_version)
    return v1_data.segments(db, model_version)


@router.post("/predict/purchase-level", response_model=s.PurchaseResponse | s.ExplainedPurchaseResponse)
def purchase(payload: Annotated[s.PurchaseRequest, Body(openapi_examples=PURCHASE_EXAMPLES)], db: Session | None = Depends(get_optional_db)):
    """Classify the current snapshot, not a purchase in a future time window."""
    ensure_persistence_allowed("classification", payload.model_version, payload.save_result)
    customer = payload.customer.model_dump()
    explanation = None
    if payload.explain:
        from backend.services.xgboost_explanation import explain_prediction
        from backend.services.versioned_models import infer_pinned
        state = versioned_models.get("classification", payload.model_version)
        result = infer_pinned("classification", payload.model_version, customer, state)
        explanation = explain_prediction(customer, state, result)
    else:
        result = infer("classification", payload.model_version, customer)
    save(db, "classification", payload.model_version, payload.save_result, [customer], [result], "single",
         [payload.customer_id], [payload.behavior_snapshot_id])
    return {**result, "explanation": explanation} if explanation is not None else result


@router.post("/predict/segment", response_model=s.SegmentResponse)
def segment(payload: Annotated[s.SegmentRequest, Body(openapi_examples=SEGMENT_EXAMPLES)], db: Session | None = Depends(get_optional_db)):
    """Describe a snapshot segment. Standardized Euclidean distance is not confidence."""
    ensure_persistence_allowed("segmentation", payload.model_version, payload.save_result)
    customer = payload.customer.model_dump()
    result = infer("segmentation", payload.model_version, customer)
    save(db, "segmentation", payload.model_version, payload.save_result, [customer], [result], "single",
         [payload.customer_id], [payload.behavior_snapshot_id])
    return result


def batch(payload, task, db):
    ensure_persistence_allowed(task, payload.model_version, payload.save_results)
    customers = [c.model_dump() for c in payload.customers]
    results = [infer(task, payload.model_version, c) for c in customers]
    save(db, task, payload.model_version, payload.save_results, customers, results, "batch",
         payload.customer_ids, payload.behavior_snapshot_ids)
    return {"total": len(results), "results": results}


@router.post("/predict/batch/purchase-level", response_model=s.PurchaseBatchResponse)
def purchase_batch(payload: s.PurchaseBatch, db: Session | None = Depends(get_optional_db)):
    return batch(payload, "classification", db)


@router.post("/predict/batch/segment", response_model=s.SegmentBatchResponse)
def segment_batch(payload: s.SegmentBatch, db: Session | None = Depends(get_optional_db)):
    return batch(payload, "segmentation", db)


@router.post("/predict/csv/purchase-level", response_class=Response,
             responses={200: {"content": {"text/csv": {"schema": {"type": "string"}}}, "description": "UTF-8 BOM CSV; provenance columns include model version"}})
async def purchase_csv(file: UploadFile = File(...), model_version: str = Form("1.0.0"),
                       save_results: bool = Form(False), db: Session | None = Depends(get_optional_db)):
    from backend.services.v1_csv import csv_prediction
    return await csv_prediction(file, "classification", model_version, save_results, db)


@router.post("/predict/csv/segment", response_class=Response,
             responses={200: {"content": {"text/csv": {"schema": {"type": "string"}}}, "description": "Distance is not probability; version-specific segment IDs"}})
async def segment_csv(file: UploadFile = File(...), model_version: str = Form("1.0.0"),
                      save_results: bool = Form(False), db: Session | None = Depends(get_optional_db)):
    from backend.services.v1_csv import csv_prediction
    return await csv_prediction(file, "segmentation", model_version, save_results, db)


@router.post("/customers", response_model=CustomerRead, status_code=201)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    return customer_service.create_customer(db, payload)


@router.get("/customers", response_model=CustomerPage)
def list_customers(offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100), include_inactive: bool = False,
                   q: str | None = Query(None, min_length=1, max_length=100),
                   sort: Literal["created_at", "external_id"] = "created_at", direction: Literal["asc", "desc"] = "desc",
                   db: Session = Depends(get_db)):
    return v1_data.customers(db, offset=offset, limit=limit, include_inactive=include_inactive, q=q, sort=sort, direction=direction)


ETAG_HEADER = {"ETag": {"description": "Opaque current customer revision; send via optional If-Match on v1 PATCH/DELETE", "schema": {"type": "string"}}}
CONDITIONAL_ERROR = {412: {"model": s.ErrorEnvelope, "description": "If-Match did not match current customer revision"}}


@router.get("/customers/{customer_id}", response_model=CustomerRead, responses={200: {"headers": ETAG_HEADER}})
def customer(customer_id: UUID, response: Response, db: Session = Depends(get_db)):
    row = customer_service.get_customer_or_404(db, customer_id)
    response.headers["ETag"] = customer_etag(row)
    return row


@router.patch("/customers/{customer_id}", response_model=CustomerRead,
              responses={200: {"headers": ETAG_HEADER}, **CONDITIONAL_ERROR})
def update_customer(customer_id: UUID, payload: s.CustomerUpdateV1, response: Response,
                    if_match: str | None = Header(None, description="Optional strong ETag from v1 GET; stale value returns412. Omission preserves last-writer-wins compatibility."),
                    db: Session = Depends(get_db)):
    row = customer_service.update_customer(db, customer_id, payload, expected_etag=if_match)
    response.headers["ETag"] = customer_etag(row)
    return row


@router.delete("/customers/{customer_id}", status_code=204, responses=CONDITIONAL_ERROR)
def deactivate_customer(customer_id: UUID, if_match: str | None = Header(None,
                        description="Optional If-Match revision check, not mandatory; legacy route unchanged."),
                        db: Session = Depends(get_db)):
    customer_service.deactivate_customer(db, customer_id, expected_etag=if_match)
    return Response(status_code=204)


@router.post("/customers/{customer_id}/behaviors", response_model=BehaviorSnapshotRead, status_code=201)
def add_behavior(customer_id: UUID, payload: s.BehaviorCreateV1, db: Session = Depends(get_db)):
    return customer_service.add_behavior_snapshot(db, customer_id, payload)


@router.get("/customers/{customer_id}/behaviors", response_model=BehaviorSnapshotPage)
def behaviors(customer_id: UUID, offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    return v1_data.behaviors(db, customer_id, offset, limit)


@router.get("/customers/{customer_id}/predictions", response_model=s.PredictionHistoryPageV1)
def predictions(customer_id: UUID, offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
                model_version: str | None = Query(None, max_length=50), db: Session = Depends(get_db)):
    return v1_data.history(db, customer_id, "classification", offset, limit, model_version)


@router.get("/customers/{customer_id}/segments", response_model=s.SegmentHistoryPageV1)
def customer_segments(customer_id: UUID, offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
                      model_version: str | None = Query(None, max_length=50), db: Session = Depends(get_db)):
    return v1_data.history(db, customer_id, "segmentation", offset, limit, model_version)
