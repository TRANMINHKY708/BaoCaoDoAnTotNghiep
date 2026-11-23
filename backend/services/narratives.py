"""F05 narrative generation reuses F04 Gemini settings, adapter and safe errors."""

import re
from datetime import UTC, datetime

from fastapi import HTTPException
from pydantic import ValidationError

from backend.core.config import GeminiSettings
from backend.schemas.narrative import NarrativeContent, NarrativeResponse
from backend.services import assistant
from backend.services.narrative_receipts import receipts
from backend.services.versioned_models import failure


def generate(ctx, token, transport_factory=None):
    facts = receipts.resolve(ctx, token)
    settings = GeminiSettings()
    key = (
        settings.gemini_api_key.get_secret_value().strip()
        if settings.gemini_api_key
        else ""
    )
    if not key:
        failure(503, "GEMINI_NOT_CONFIGURED", "Trợ lý AI chưa được cấu hình API key.")
    model = settings.gemini_model.strip()
    if not re.fullmatch(r"gemini-[a-zA-Z0-9.-]{1,80}", model):
        failure(
            503, "GEMINI_MODEL_CONFIGURATION_INVALID", "Tên mô hình AI chưa hợp lệ."
        )
    if not assistant.SLOTS.acquire(blocking=False):
        failure(429, "ASSISTANT_BUSY", "Trợ lý đang bận. Vui lòng thử lại sau.")
    provider = None
    research_used = False
    try:
        if facts["kind"] == "segmentation":
            from backend.services.segmentation_profiles import research_profiles

            try:
                profile = research_profiles(facts["data"]["model_version"])
                if (
                    profile["artifact_sha256"] == facts["data"]["artifact_sha256"]
                    and profile["model_version"] == facts["data"]["model_version"]
                ):
                    cluster = next(
                        (
                            item
                            for item in profile["clusters"]
                            if item["cluster_id"] == facts["data"]["cluster"]
                        ),
                        None,
                    )
                    if cluster:
                        facts["research_profile"] = {
                            "source": "cleaned_research_dataset",
                            "model_version": profile["model_version"],
                            "records_used": profile["records_used"],
                            "statistics_space": profile["statistics_space"],
                            "cluster": {
                                k: cluster[k]
                                for k in (
                                    "cluster_id",
                                    "record_count",
                                    "share_percent",
                                    "status",
                                )
                            },
                            "notable_features": cluster["notable_features"][:3],
                        }
                        research_used = True
            except HTTPException:
                pass
            if not research_used:
                facts["research_profile_status"] = (
                    "unavailable_or_incompatible_no_substitute"
                )
        provider = (transport_factory or assistant.Gemini)(key)
        provider_facts = {
            k: v
            for k, v in facts.items()
            if k not in {"fingerprint", "capability", "_export"}
        }
        provider_facts["data"] = {
            k: v for k, v in facts["data"].items() if k != "artifact_sha256"
        }
        raw = provider.generate_narrative(
            model, provider_facts, NarrativeContent.model_json_schema()
        )
        if not raw or len(raw) > 20000:
            failure(
                502,
                "NARRATIVE_INVALID_RESPONSE",
                "AI chưa trả nhận xét hợp lệ. Vui lòng thử lại.",
            )
        try:
            content = NarrativeContent.model_validate_json(raw.replace(key, "[đã ẩn]"))
        except ValidationError:
            failure(
                502,
                "NARRATIVE_INVALID_RESPONSE",
                "AI chưa trả nhận xét đúng cấu trúc. Vui lòng thử lại.",
            )
        result = NarrativeResponse(
            narrative=content,
            analysis_kind=facts["kind"],
            result_fingerprint=facts["fingerprint"],
            model_versions=facts["model_versions"],
            research_profile_used=research_used,
            generated_at=datetime.now(UTC),
        )
        receipts.remember_narrative(ctx, token, result)
        return result
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 -- normalize provider failures without exposing secrets
        assistant.provider_error(exc)
    finally:
        if provider:
            try:
                provider.close()
            except Exception:  # noqa: BLE001, S110 -- never log provider credentials/payloads
                pass
        assistant.SLOTS.release()
