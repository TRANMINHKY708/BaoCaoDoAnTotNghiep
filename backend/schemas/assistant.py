"""Bounded, stateless assistant contract. Client history is never authorization."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ChatTurn(Strict):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(Strict):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=10)
    customer_id: UUID | None = None

    @model_validator(mode="after")
    def context_limit(self):
        if len(self.message) + sum(len(x.content) for x in self.history) > 12000:
            raise ValueError("Conversation context exceeds limit")
        return self


class Source(Strict):
    tool: str
    source: Literal[
        "application_postgresql",
        "cleaned_research_dataset",
        "research_reports",
        "pinned_model_artifact",
        "application_workspace_aggregate",
    ]
    customer_id: UUID | None = None
    records_returned: int = Field(ge=0)


class ChatResponse(Strict):
    message: str
    model: str
    generated_at: datetime
    sources: list[Source]
    history_persisted: Literal[False] = False
    disclaimer: str = "Nội dung do AI tổng hợp; hãy đối chiếu dữ liệu nguồn. Không chứng minh quan hệ nhân quả hoặc dự báo chắc chắn hành vi tương lai."
