"""F11 calls the F04 provider using F05 content schema, aggregate facts only."""

import re
from datetime import UTC, datetime

from fastapi import HTTPException
from pydantic import ValidationError

from backend.core.config import GeminiSettings
from backend.schemas.batch_analytics import BatchNarrative
from backend.schemas.narrative import NarrativeContent
from backend.services import assistant
from backend.services.versioned_models import failure


def generate(data, transport_factory=None):
    if data["kpis"]["stored_results"] == 0:
        failure(
            409,
            "BATCH_NO_SAVED_RESULTS",
            "Chưa có kết quả ML đã lưu trong phạm vi này để nhận xét.",
        )
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
    try:
        # Deliberately omit filters, UUIDs, names, source filenames and per-customer rows.
        facts = {
            key: data[key]
            for key in (
                "source",
                "kpis",
                "definitions",
                "purchase_distribution",
                "cluster_distribution",
                "cluster_profiles",
                "overall_means",
                "trend",
                "trend_available",
                "warnings",
            )
        }
        facts["models"] = [
            {"task": m["task"], "model_version": m["model_version"]}
            for m in data["models"]
        ]
        facts["kind"] = "batch_analytics"
        # Product wording for context only; numerical facts and model identities stay intact.
        facts["source"] = "Dữ liệu phân tích đã lưu trong hệ thống"
        facts["definitions"] = {
            name: re.sub(
                r"\s+([,.;:])", r"\1", re.sub(r"\s+F\d{1,2}\b", "", definition)
            )
            for name, definition in data["definitions"].items()
        }
        facts["warnings"] = [
            re.sub(r"\s+([,.;:])", r"\1", re.sub(r"\s+F\d{1,2}\b", "", warning))
            for warning in data["warnings"]
        ]
        facts["scope"] = (
            "Tổng hợp dữ liệu hệ thống trong bộ lọc đã xác minh; không suy ra nhân quả hoặc dự báo giao dịch tương lai. Chưa đủ hai ngày thì nói 'chưa đủ dữ liệu theo thời gian', không nhắc tên biến hoặc boolean. Phân bố mức mua và nhóm đếm kết quả đã lưu, không được gọi count là số khách hàng hay snapshot duy nhất. Chỉ KPI customers và snapshots mới là số duy nhất tương ứng; records trong profile là bản ghi kết quả phân nhóm. Không tự đặt tên VIP/trung thành cho cluster. Không nhắc mã bước nội bộ hoặc tên cơ sở dữ liệu. Các gợi ý chỉ để tham khảo."
        )
        provider = (transport_factory or assistant.Gemini)(key)
        raw = provider.generate_narrative(
            model, facts, NarrativeContent.model_json_schema()
        )
        if not raw or len(raw) > 20000:
            failure(502, "NARRATIVE_INVALID_RESPONSE", "AI chưa trả nhận xét hợp lệ.")
        try:
            content = NarrativeContent.model_validate_json(raw.replace(key, "[đã ẩn]"))
        except ValidationError:
            failure(
                502, "NARRATIVE_INVALID_RESPONSE", "AI chưa trả nhận xét đúng cấu trúc."
            )
        return BatchNarrative(
            narrative=content,
            result_fingerprint=data["fingerprint"],
            generated_at=datetime.now(UTC),
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 -- existing provider redaction and safe errors
        assistant.provider_error(exc)
    finally:
        if provider:
            try:
                provider.close()
            except Exception:  # noqa: BLE001, S110 -- never log provider secrets on close
                pass
        assistant.SLOTS.release()
