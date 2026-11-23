"""Six additive What-if operations. No change to the 39 pre-existing routes."""
import json
import logging
import math
import time
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from fastapi.routing import APIRoute
from fastapi.exceptions import RequestValidationError
from pydantic import Field, UUID4
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from backend.db.session import get_db, get_optional_db
from backend.schemas import what_if as s
from backend.schemas.v1 import ErrorEnvelope
from backend.services import what_if_engine as engine, what_if_storage as storage
from backend.services.versioned_models import failure, versioned_models
from src.data.dataset_contract import FIELDS

logger = logging.getLogger("ecommerce.what_if")


class WhatIfRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()
        async def process(request: Request):
            if request.method == "POST":
                chunks, size = [], 0
                async for chunk in request.stream():
                    size += len(chunk)
                    if size > 65536:
                        failure(413, "PAYLOAD_TOO_LARGE", "What-if JSON body is limited to64KiB")
                    chunks.append(chunk)
                body = b"".join(chunks)
                request._body = body
                try:
                    raw = body.decode("utf-8")
                    depth, in_string, escaped = 0, False, False
                    for char in raw:
                        if in_string:
                            if escaped: escaped = False
                            elif char == "\\": escaped = True
                            elif char == '"': in_string = False
                        elif char == '"': in_string = True
                        elif char in "{[":
                            depth += 1
                            if depth > 8: failure(422, "VALIDATION_ERROR", "JSON nesting exceeds8 levels")
                        elif char in "}]": depth -= 1
                    def pairs(items):
                        result = {}
                        for key, value in items:
                            if key in result: failure(400, "DUPLICATE_JSON_KEY", "Duplicate JSON keys are forbidden")
                            result[key] = value
                        return result
                    def invalid_constant(value):
                        raise ValueError("Invalid JSON constant")
                    parsed = json.loads(raw, object_pairs_hook=pairs, parse_constant=invalid_constant)
                    def finite(value):
                        if isinstance(value, float) and not math.isfinite(value): raise ValueError("Nonfinite JSON")
                        if isinstance(value, str): value.encode("utf-8")
                        if isinstance(value, dict):
                            for key, item in value.items(): finite(key); finite(item)
                        if isinstance(value, list):
                            for item in value: finite(item)
                    finite(parsed)
                    models = parsed.get("models") if isinstance(parsed, dict) else None
                    if isinstance(models, dict):
                        for task, allowed in (("classification", ("1.0.0", s.T4_VERSION)), ("segmentation", ("1.0.0", s.T5_VERSION))):
                            value = models.get(task)
                            if isinstance(value, str) and value not in allowed:
                                failure(404, "MODEL_VERSION_NOT_FOUND", "Unknown model version for this task")
                    if isinstance(parsed, dict) and isinstance(parsed.get("changes"), dict) and set(parsed["changes"]) - set(s.MUTABLE):
                        failure(422, "IMMUTABLE_FEATURE", "Only the six approved interaction features may be changed")
                except (ValueError, UnicodeError, RecursionError):
                    failure(400, "INVALID_JSON", "Body must be finite UTF-8 JSON")
            return await original(request)
        async def handler(request: Request):
            started = time.perf_counter()
            status = 500
            try:
                response = await process(request)
                status = response.status_code
                return response
            except RequestValidationError:
                status = 422
                raise
            except Exception as exc:
                status = 503 if isinstance(exc, SQLAlchemyError) else getattr(exc, "status_code", 500)
                raise
            finally:
                logger.info("what_if_request", extra={"request_id": str(getattr(request.state, "request_id", "")),
                    "operation": self.name, "status": status, "elapsed_ms": round((time.perf_counter() - started) * 1000, 3)})
        return handler


class WhatIfFeatureDescriptor(s.StrictDTO):
    name: str
    type: str
    minimum: float | None
    maximum: float | None
    categories: list[str]
    mutable: bool
    unit: str
    nullable_model: bool


class WhatIfModelDescriptor(s.StrictDTO):
    task: str
    model_id: str
    model_version: str
    artifact_sha256: str
    metadata_sha256: str
    available: bool
    feature_count: int
    features: list[WhatIfFeatureDescriptor]
    input_schema: dict[str, Any]
    persistence_supported: bool
    label_namespace: str
    labels: dict[str, str]
    supports_probabilities: bool
    distance_kind: str | None


class WhatIfSchemaResponse(s.StrictDTO):
    contract_version: Literal["what-if-snapshot-v1"]
    models: list[WhatIfModelDescriptor]
    mutable_features: list[str]
    limits: dict[str, int]
    scope: Literal["snapshot_input_sensitivity_not_causal_or_future"]
    disclaimer: Literal[s.NON_CAUSAL]
    limitations: list[str]


router = APIRouter(prefix="/api/v1/what-if", route_class=WhatIfRoute, tags=["What-if — non-causal snapshot"],
    responses={n: {"model": ErrorEnvelope} for n in (400, 404, 409, 413, 422, 500, 503)})


def required_db(db: Session | None = Depends(get_optional_db)):
    if db is None:
        failure(503, "DATABASE_UNAVAILABLE", "Scenario storage requires a configured database")
    return db


@router.get("/schema", response_model=WhatIfSchemaResponse)
def schema():
    specs = {f.name: f for f in FIELDS}
    models = []
    for info in versioned_models.catalog()["models"]:
        pin = next(p for p in engine.pins() if p["task"] == info["task"] and p["version"] == info["model_version"])
        descriptors = [dict(name=n, type=specs[n].kind, minimum=specs[n].minimum, maximum=specs[n].maximum,
            categories=list(specs[n].categories), mutable=n in s.MUTABLE,
            unit="percent_0_100" if n == "Email_Open_Rate" else "source_unit_not_fully_verified",
            nullable_model=not info["is_default"]) for n in info["features"]]
        models.append(dict(task=info["task"], model_id=info["model_id"], model_version=info["model_version"],
            artifact_sha256=pin["artifact_sha256"], metadata_sha256=pin["metadata_sha256"], available=info["available"],
            feature_count=info["feature_count"], features=descriptors, input_schema=info["input_schema"],
            persistence_supported=info["persistence_supported"], label_namespace=info["label_namespace"], labels=info["labels"],
            supports_probabilities=info["task"] == "classification",
            distance_kind="standardized_euclidean_not_probability" if info["task"] == "segmentation" else None))
    return dict(contract_version=s.CONTRACT_VERSION, models=models, mutable_features=list(s.MUTABLE),
        limits=dict(body_bytes=65536, nesting_depth=8, changes=6, scenarios_per_request=1, history_limit=100),
        scope=engine.SCOPE, disclaimer=s.NON_CAUSAL,
        limitations=["snapshot_only", "not_causal_or_future", "legacy_proxy_risks_remain", "research_inference_only", "local_single_owner_no_auth", "advisory_lock_not_database_unique"])


@router.post("/preview", response_model=s.PreviewResponse)
def preview(payload: s.PreviewRequest, db: Session | None = Depends(get_optional_db)):
    return engine.evaluate(payload, db, compare=False)


@router.post("", response_model=s.ComparisonResponse)
def compare(payload: s.CompareRequest, db: Session | None = Depends(get_optional_db)):
    return engine.evaluate(payload, db)


@router.post("/scenarios", response_model=s.SavedScenarioDetail, status_code=201,
    responses={200: {"model": s.SavedScenarioDetail, "description": "Idempotent replay of the stored scenario"}})
def save(payload: s.SaveRequest, response: Response,
         idempotency_key: Annotated[UUID4 | None, Header(description="Required UUIDv4; retry the identical payload with the same key")] = None,
         db: Session | None = Depends(get_optional_db)):
    if idempotency_key is None:
        failure(422, "IDEMPOTENCY_KEY_REQUIRED", "Save requires an Idempotency-Key UUIDv4 header")
    saved, created = storage.save(db, payload, idempotency_key)
    response.status_code = 201 if created else 200
    return saved


@router.get("/scenarios", response_model=s.HistoryPage)
def history(request: Request, customer_id: UUID | None = None,
            classification_model_version: Literal["1.0.0", "2.0.0-snapshot-conservative12"] | None = None,
            offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100), db: Session = Depends(required_db)):
    if set(request.query_params) - {"customer_id", "classification_model_version", "offset", "limit"}:
        failure(422, "VALIDATION_ERROR", "Unsupported history query parameter")
    return storage.history(db, s.HistoryQuery(customer_id=customer_id, classification_model_version=classification_model_version, offset=offset, limit=limit))


@router.get("/scenarios/{scenario_id}", response_model=s.SavedScenarioDetail)
def detail(scenario_id: UUID, db: Session = Depends(required_db)):
    return storage.detail(db, scenario_id)
