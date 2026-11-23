"""F08 request DTOs. Counts/normalized rows cannot be supplied by the client."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class BulkDTO(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, hide_input_in_errors=True)


class ModelSelection(BulkDTO):
    task: Literal["classification", "segmentation"]
    version: str = Field(min_length=1, max_length=80)


class PreviewRequest(BulkDTO):
    upload_reference: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
    mapping: dict[str, str] = Field(default_factory=dict, max_length=64)
    profile: Literal["snapshot", "model_input"] = "snapshot"
    models: list[ModelSelection] = Field(default_factory=list, max_length=4)
    page: int = Field(default=1, ge=1, le=1000)
    page_size: int = Field(default=25, ge=1, le=50)
    status: Literal["all", "valid", "error", "warning", "duplicate", "skipped"] = "all"


class PrepareRequest(BulkDTO):
    upload_reference: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
    preview_reference: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
    acknowledge_review: bool = False
    accept_partial: bool = False


class BulkStats(BulkDTO):
    total: int
    valid: int
    error: int
    warning: int
    duplicate: int
    skipped: int
    snapshot_eligible: int
    snapshot_ineligible: int


class InspectionResponse(BulkDTO):
    upload_reference: str
    filename: str
    size: int
    file_fingerprint: str
    headers: list[str]
    total_rows: int
    expires_at: str
    contract: dict


class PreviewRow(BulkDTO):
    row: int
    status: Literal["valid", "error", "warning", "duplicate"]
    valid: bool
    error: bool
    warning: bool
    duplicate: bool
    skipped: bool
    row_key: str | None
    identity: dict[str, str] | None
    snapshot_eligible: bool
    missing_features: list[str]
    values: dict[str, str]


class Diagnostic(BulkDTO):
    row: int | None
    source_column: str | None
    field: str | None
    code: str
    severity: Literal["warning", "error"]
    message: str
    value: str | None


class PreviewResponse(BulkDTO):
    preview_reference: str
    expires_at: str
    valid: bool
    mapping_valid: bool
    stats: BulkStats
    rows: list[PreviewRow]
    issues: list[Diagnostic]
    page: int
    page_size: int
    filtered_rows: int
    database_written: Literal[False]


class ManifestResponse(BulkDTO):
    state: Literal["prepared_not_imported"]
    dataset_type: Literal["behavior", "orders"]
    contract_version: str
    filename: str
    size: int
    file_fingerprint: str
    mapping: dict[str, str]
    profile: Literal["snapshot", "model_input"]
    models: list[ModelSelection]
    stats: BulkStats
    row_keys: list[str]
    created_at: str
    expires_at: str
    database_written: Literal[False]
    manifest_digest: str
    manifest_reference: str
