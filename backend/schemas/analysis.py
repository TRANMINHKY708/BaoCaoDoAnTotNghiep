from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import Field

from backend.schemas.v1 import StrictObject


class AnalysisRequest(StrictObject):
    import_job_id: UUID
    task: Literal["classification", "segmentation"]
    model_version: str = Field(min_length=1, max_length=80)
    save_results: bool = Field(default=False, strict=True)


class AnalysisSummary(StrictObject):
    job_id: UUID
    import_job_id: UUID
    task: Literal["classification", "segmentation"]
    model_version: str
    artifact_sha256: str
    metadata_sha256: str
    persist_results: bool
    status: Literal["queued", "running", "completed", "failed"]
    counts: dict[str, int]
    attempts: int
    error_code: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None


class AnalysisList(StrictObject):
    items: list[AnalysisSummary]


class AnalysisRow(StrictObject):
    customer_id: UUID
    customer_reference: str
    snapshot_id: UUID
    status: Literal["queued", "success", "skipped", "failed"]
    error_code: str | None
    saved: bool
    result: dict[str, Any] | None


class AnalysisDetail(StrictObject):
    job: AnalysisSummary
    offset: int
    limit: int
    preview_available: int
    distribution: dict[str, int]
    rows: list[AnalysisRow]
