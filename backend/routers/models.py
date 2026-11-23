"""K9 model management: read-only usage of registered model versions (no upload, retraining or promotion)."""

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from backend.schemas.v1 import ErrorEnvelope
from backend.services.dashboard import get_dashboard_connection
from backend.services.model_usage import model_usage

router = APIRouter(prefix="/api/v1/models", tags=["API v1 — models"],
                   responses={n: {"model": ErrorEnvelope} for n in (503,)})


class RunsByType(BaseModel):
    model_config = ConfigDict(extra="forbid")
    single: int = Field(ge=0)
    batch: int = Field(ge=0)
    csv: int = Field(ge=0)
    scenario: int = Field(ge=0)


class ModelUsage(BaseModel):
    model_config = ConfigDict(extra="forbid", protected_namespaces=())
    model_id: str
    model_version: str
    task: Literal["classification", "segmentation", "what_if"]
    algorithm: str
    artifact_sha256: str | None
    registered_at: str
    runs_total: int = Field(ge=0)
    runs_completed: int = Field(ge=0)
    runs_by_type: RunsByType
    results_saved: int = Field(ge=0)
    customers: int = Field(ge=0)
    last_used_at: str | None


class ModelUsageResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", protected_namespaces=())
    generated_at: str
    models: list[ModelUsage]
    scope: str


@router.get("/usage", response_model=ModelUsageResponse)
def usage(conn=Depends(get_dashboard_connection)):
    """Saved runs and results per registered model version, from PostgreSQL (read-only transaction)."""
    return model_usage(conn)
