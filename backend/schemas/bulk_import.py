"""F09 confirms server receipts, never client-supplied customer fields/counts."""

from typing import Literal

from pydantic import Field, field_validator

from backend.schemas.bulk import BulkDTO


class ImportRequest(BulkDTO):
    manifest_reference: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
    manifest_digest: str = Field(pattern=r"^[a-f0-9]{64}$")
    idempotency_key: str = Field(
        pattern=r"^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"
    )
    acknowledge_import: Literal[True]
    accept_partial: bool = False

    @field_validator("acknowledge_import", mode="before")
    @classmethod
    def explicit_confirmation(cls, value):
        if value is not True:
            raise ValueError("Explicit confirmation required")
        return value


class JobSummary(BulkDTO):
    job_id: str
    idempotency_key: str
    status: Literal["pending", "completed", "failed"]
    counts: dict[str, int]
    metadata: dict
    created_at: str
    completed_at: str | None
    error_code: str | None
    error_row: int | None


class JobDetail(BulkDTO):
    job: JobSummary
    total_rows: int
    offset: int
    limit: int
    rows: list[dict]


class JobList(BulkDTO):
    items: list[JobSummary]
