"""F05: only a server-issued reference is accepted, never client statistics."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class NarrativeRequest(Strict):
    receipt: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")


Item = Annotated[str, Field(min_length=1, max_length=1000)]


class NarrativeContent(Strict):
    overview: str = Field(min_length=1, max_length=2000)
    notable_factors: list[Item] = Field(max_length=6)
    interpretation: str = Field(min_length=1, max_length=3000)
    limitations: list[Item] = Field(min_length=1, max_length=6)
    reference_suggestions: list[Item] = Field(max_length=5)


class NarrativeResponse(Strict):
    narrative: NarrativeContent
    analysis_kind: Literal["prediction", "segmentation", "what_if"]
    source: Literal["verified_live_backend_result"] = "verified_live_backend_result"
    result_fingerprint: str
    model_versions: list[str]
    research_profile_used: bool
    generated_at: datetime
    history_persisted: Literal[False] = False
