"""Fixed read-only queries; model arguments cannot select a customer or SQL."""

import json
from functools import lru_cache
from typing import Literal
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, ValidationError
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError

from backend.core.account_permissions import permitted
from backend.models.customer import Customer, CustomerBehaviorSnapshot
from backend.models.ml import MLModel
from backend.models.prediction import PredictionResult, SegmentationResult
from backend.models.scenario import PredictionScenario
from backend.schemas.assistant import Source
from backend.schemas.what_if import WhatIfHistoryQuery
from backend.services import v1_data, what_if_storage
from backend.services.customer_service import (
    get_customer_or_404,
    list_behavior_snapshots,
)
from backend.services.model_service import PROJECT_ROOT


class NoArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class RecordArgs(NoArgs):
    record_id: str


class ResearchArgs(NoArgs):
    model_version: Literal["1.0.0", "2.0.0-snapshot-k3"]


class ResultsArgs(NoArgs):
    topic: Literal["dataset", "purchase_model", "churn_model", "segmentation"]


# Tools whose data is not one customer's rows -> source label of the answer.
GLOBAL_SOURCES = {
    "get_research_segment_profiles": "cleaned_research_dataset",
    "get_research_results": "research_reports",
    "get_churn_model_info": "pinned_model_artifact",
    "get_workspace_overview": "application_workspace_aggregate",
}


TOOLS = {
    "get_customer_summary": (
        NoArgs,
        "customers.read",
        "Thông tin tối thiểu khách hàng đã chọn; không trả định danh cá nhân.",
    ),
    "get_customer_analysis_history": (
        NoArgs,
        "history.read",
        "Tối đa 5 kết quả gần nhất mỗi loại dự đoán, phân nhóm, mô phỏng của khách hàng đã chọn.",
    ),
    "get_prediction_details": (
        RecordArgs,
        "history.read",
        "Đọc một dự đoán đã lưu của khách hàng đã chọn bằng record_id.",
    ),
    "get_segmentation_details": (
        RecordArgs,
        "history.read",
        "Đọc một phân nhóm đã lưu của khách hàng đã chọn bằng record_id.",
    ),
    "get_whatif_details": (
        RecordArgs,
        "history.read",
        "Đọc nhãn và xác suất trước/sau của mô phỏng đã lưu, thuộc khách hàng đã chọn.",
    ),
    "get_research_segment_profiles": (
        ResearchArgs,
        "models.read",
        "Thống kê F02 của dataset nghiên cứu đã làm sạch, KHÔNG phải khách hàng PostgreSQL.",
    ),
    "get_customer_churn_risk": (
        NoArgs,
        "inference.json.run",
        ("Dự báo nguy cơ rời bỏ (churn) của khách hàng đã chọn từ snapshot hành vi mới nhất: "
        "xác suất, mức rủi ro, ngưỡng và các yếu tố SHAP chính. Không lưu kết quả. "
        "Nếu snapshot đã ghi nhận khách rời bỏ thì trả trạng thái quan sát, không dự báo lại."),
    ),
    "get_churn_model_info": (
        NoArgs,
        "models.read",
        ("Mô hình dự báo rời bỏ đang dùng: phiên bản, thuộc tính đầu vào và bị loại, ngưỡng quyết định, "
        "ngưỡng mức rủi ro, chỉ số holdout chấm một lần, trạng thái sẵn sàng và giới hạn."),
    ),
    "get_research_results": (
        ResultsArgs,
        "models.read",
        ("Kết quả nghiên cứu đã chốt của đồ án theo chủ đề: dataset (dữ liệu, EDA, phân khúc nghiên cứu); "
        "purchase_model (mô hình mức mua: so sánh thuật toán, holdout, rò rỉ Lifetime_Value, SHAP toàn cục); "
        "churn_model (so sánh mô hình rời bỏ, kiểm định, holdout, nhóm rủi ro, SHAP toàn cục); "
        "segmentation (K-Means K=3: chọn K, chỉ số nội tại, độ ổn định, hồ sơ cụm)."),
    ),
    "get_workspace_overview": (
        NoArgs,
        "dashboard.read",
        ("Số liệu tổng hợp của workspace: số khách hàng, snapshot, kết quả dự đoán, phân nhóm, mô phỏng đã lưu "
        "và tỷ lệ churn đã ghi nhận ở snapshot mới nhất. Không có thông tin từng khách."),
    ),
}

RESEARCH_FILES = {
    "insights": "frontend/src/features/insights/researchInsights.json",
    "churn": "frontend/src/features/churn/data/churnReport.json",
    "cluster": "frontend/src/features/explorer/data/clusterReport.json",
}
CHURN_FACTORS_RETURNED = 8
TOOL_BYTES, TOTAL_BYTES = 16000, 40000  # per tool result, per chat request


@lru_cache(maxsize=4)
def research_file(name):
    """Committed exports of the frozen research reports (read only, nothing is re-scored)."""
    return json.loads((PROJECT_ROOT / RESEARCH_FILES[name]).read_text(encoding="utf-8"))


def _side(result):
    return pick(result, ["metrics", "per_class_f1", "ci95", "confusion_matrix"])


def research_results(topic):
    if topic == "dataset":
        r = research_file("insights")
        eda = r["eda"]
        return {
            "dataset": r["dataset"],
            "source_columns": eda["source_columns"],
            "purchase_level_counts": eda["class_counts"],
            "purchase_level_rule": "Total_Purchases <=10 Low, >10 đến 15 Medium, >15 High",
            "churn_rate_percent": eda["churn_rate_percent"],
            "median_by_purchase_level": eda["median_by_level"],
            "spearman_with_total_purchases": eda["spearman_with_total_purchases"],
            "signup_quarter": eda["signup_quarter"],
            "research_segments": [
                pick(x, ["name", "rows", "share_percent", "purchase_level_percent",
                         "churn_rate_percent", "goal", "actions"])
                for x in r["segments"]["items"]
            ],
            "cramers_v": {"purchase_level": r["segments"]["cramers_v_purchase_level"],
                          "churn": r["segments"]["cramers_v_churn"]},
        }
    if topic == "purchase_model":
        r = research_file("insights")
        h = r["holdout"]
        return {
            "task": "Phân loại Purchase_Level (Low/Medium/High) từ snapshot hành vi",
            "cross_validation_summary": r["models"]["summary"],
            "feature_set_gain_macro_f1_full24_minus_conservative12": r["models"]["feature_set_gain"],
            "holdout": {
                "rows": h["rows"], "scored_once_at": h["scored_at"], "bootstrap": h["bootstrap"],
                "conservative12_main_model": _side(h["conservative12"]),
                "full24_reference_with_leakage_risk": _side(h["full24"]),
                "paired_gain_full24_macro_f1": h["paired_gain_full24"],
            },
            "leakage_lifetime_value": r["leakage"],
            "global_shap": {"model": r["shap"]["model"], "rows": r["shap"]["rows"],
                            "ranking": r["shap"]["ranking"][:12]},
        }
    if topic == "churn_model":
        c = research_file("churn")
        h = c["holdout"]
        return {
            "model": pick(c["model"], ["model_version", "feature_policy", "task", "algorithm",
                                       "hyperparameters", "input_features", "excluded_features",
                                       "decision_threshold", "risk_thresholds", "fit_rows",
                                       "train_churn_rate", "trained_at_utc"]),
            "cross_validation": {
                "rows": [{k: v for k, v in x.items() if k != "fold_roc_auc"}
                         for x in c["comparison"]["rows"]],
                "friedman": c["comparison"]["friedman"],
                "best_vs_others": c["comparison"]["best_vs_others"],
                "feature_set_effect_roc_auc": c["comparison"]["feature_set_effect"],
                "grid_chosen": c["comparison"]["grid_chosen"],
                "class_weighting": c["comparison"]["class_weighting"],
            },
            "holdout": {
                **pick(h, ["rows", "churn_rate", "scored_at_utc", "primary", "ci95", "reference",
                           "paired_difference_roc_auc", "confusion_matrix", "risk_bands",
                           "by_segment"]),
                "confusion_matrix_layout": "[[TN, FP], [FN, TP]] tại ngưỡng quyết định",
                "reference_meaning": "bộ thuộc tính tham chiếu gồm cả các biến lịch sử bị loại khỏi mô hình chính",
            },
            "out_of_fold": c["oof"],
            "global_shap": {"scope": c["shap"]["scope"], "ranking": c["shap"]["ranking"][:12]},
        }
    k = research_file("cluster")
    aris = [x["ari"] for x in k["stability"]["results"] if x.get("ari") is not None]
    return {
        **pick(k, ["model_version", "k", "k_selection", "features", "rows", "segments"]),
        "k_diagnostics": k["k_diagnostics"],
        "internal_validation": k["internal_validation"],
        "silhouette_overall": k["silhouette"]["overall"],
        "stability": {"interpretation": k["stability"]["interpretation"],
                      "runs": len(k["stability"]["results"]),
                      "min_ari": min(aris) if aris else None},
        "pca_explained_variance_ratio": k["pca"]["explained_variance_ratio"],
        "centroids_standardized": k["centroids_standardized"],
        "segment_mix": k["mix"],
    }


def churn_model_info():
    from backend.services.churn_model import churn_model

    info = churn_model.info()
    return {key: info[key] for key in (
        "model_version", "feature_policy", "available", "feature_count", "features",
        "excluded_features", "decision_threshold", "risk_thresholds", "holdout", "limitations")}


def declarations():
    return [
        {
            "name": name,
            "description": description,
            "parameters_json_schema": schema.model_json_schema(),
        }
        for name, (schema, _, description) in TOOLS.items()
    ]


def pick(value, names):
    if hasattr(value, "model_dump"):
        value = value.model_dump(mode="json")
    return {key: value[key] for key in names if key in value}


class ReadTools:
    def __init__(self, db, user, customer_id):
        self.db, self.user, self.customer_id = db, user, customer_id
        self.sources = []
        self.remaining_bytes = TOTAL_BYTES

    def run(self, name, arguments):
        if name not in TOOLS:
            return {"error": "TOOL_NOT_ALLOWED"}
        schema, capability, _ = TOOLS[name]
        if not permitted(self.user, [capability]):
            return {"error": "FORBIDDEN"}
        try:
            args = schema.model_validate(arguments)
            record_id = UUID(args.record_id) if isinstance(args, RecordArgs) else None
        except (ValidationError, ValueError, TypeError):
            return {"error": "INVALID_TOOL_ARGUMENTS"}
        source = GLOBAL_SOURCES.get(name, "application_postgresql")
        database = source.startswith("application_")
        if source == "application_postgresql" and self.customer_id is None:
            return {"error": "CUSTOMER_CONTEXT_REQUIRED"}
        try:
            if name == "get_research_results":
                data, count = research_results(args.topic), 1
            elif name == "get_churn_model_info":
                data, count = churn_model_info(), 1
            elif name == "get_research_segment_profiles":
                from backend.services.segmentation_profiles import research_profiles

                profile = research_profiles(args.model_version)
                data = pick(
                    profile,
                    [
                        "source",
                        "model_id",
                        "model_version",
                        "computed_at",
                        "status",
                        "total_records",
                        "records_used",
                        "count_unit",
                        "statistics_space",
                        "disclaimer",
                        "overall",
                    ],
                )
                data["clusters"] = [
                    dict(
                        **pick(
                            c, ["cluster_id", "record_count", "share_percent", "status"]
                        ),
                        notable_features=c["notable_features"][:3],
                    )
                    for c in profile["clusters"]
                ]
                count = len(data["clusters"])
            else:
                # The session is dedicated to this request; no commits or writes.
                # PostgreSQL enforces read-only in addition to the fixed query allowlist.
                self.db.execute(text("SET TRANSACTION READ ONLY"))
                self.db.execute(text("SET LOCAL statement_timeout = '3000ms'"))
                data, count = (self._overview() if name == "get_workspace_overview"
                               else self._database(name, record_id))
            encoded = json.dumps(data, default=str, ensure_ascii=False, allow_nan=False)
            size = len(encoded.encode("utf-8"))
            if size > min(TOOL_BYTES, self.remaining_bytes):
                return {"error": "TOOL_CONTEXT_LIMIT"}
            self.remaining_bytes -= size
            self.sources.append(
                Source(
                    tool=name,
                    source=source,
                    customer_id=self.customer_id if source == "application_postgresql" else None,
                    records_returned=count,
                )
            )
            return {"untrusted_source_data": json.loads(encoded)}
        except HTTPException as exc:
            return {
                "error": "NOT_FOUND" if exc.status_code == 404 else "SOURCE_UNAVAILABLE"
            }
        except (SQLAlchemyError, ValueError, KeyError, TypeError, OSError):
            return {"error": "SOURCE_UNAVAILABLE"}
        finally:
            if database:
                self.db.rollback()

    def _overview(self):
        db = self.db
        latest = (
            select(CustomerBehaviorSnapshot.customer_id,
                   func.max(CustomerBehaviorSnapshot.captured_at).label("captured_at"))
            .group_by(CustomerBehaviorSnapshot.customer_id).subquery()
        )
        churned = db.execute(
            select(func.count(), func.count().filter(CustomerBehaviorSnapshot.churned.is_(True)))
            .select_from(CustomerBehaviorSnapshot)
            .join(latest, (latest.c.customer_id == CustomerBehaviorSnapshot.customer_id)
                  & (latest.c.captured_at == CustomerBehaviorSnapshot.captured_at))
        ).one()
        count = lambda model, *where: db.scalar(select(func.count()).select_from(model).where(*where)) or 0
        return {
            "customers_total": count(Customer),
            "customers_active": count(Customer, Customer.is_active.is_(True)),
            "behavior_snapshots": count(CustomerBehaviorSnapshot),
            "customers_with_snapshot": churned[0],
            "latest_snapshot_recorded_churned": churned[1],
            "saved_purchase_predictions": count(PredictionResult),
            "saved_segmentations": count(SegmentationResult),
            "saved_what_if_scenarios": count(PredictionScenario),
            "scope": "toàn bộ workspace dùng chung tại thời điểm hỏi; churn là trạng thái đã ghi trong snapshot, không phải dự báo",
        }, 1

    def _churn(self):
        from backend.services.churn_model import churn_model
        from src.training.churn_policy import MAIN_FEATURES

        items, total = list_behavior_snapshots(self.db, self.customer_id, offset=0, limit=1)
        if not items:
            return {"status": "no_snapshot", "snapshots_total": 0}, 0
        snapshot = items[0]
        base = {"snapshot_captured_at": snapshot.captured_at, "snapshots_total": total}
        if snapshot.churned:
            return {**base, "status": "observed_churned",
                    "note": "Snapshot đã ghi nhận khách rời bỏ; hệ thống không dự báo lại."}, 1
        customer = {feature: getattr(snapshot, feature.lower()) for feature in MAIN_FEATURES}
        result = churn_model.predict(customer, explain=True)
        explanation = result["explanation"]
        return {
            **base,
            "status": "predicted",
            **pick(result, ["model_version", "churn_probability", "risk_level", "predicted_churn",
                            "decision_threshold", "risk_thresholds", "scope"]),
            "shap_log_odds": {
                "base_value": explanation["base_value"],
                "model_output": explanation["model_output"],
                "top_factors": explanation["factors"][:CHURN_FACTORS_RETURNED],
                "factors_total": len(explanation["factors"]),
                "disclaimer": explanation["disclaimer"],
            },
            "persisted": False,
        }, 1

    def _database(self, name, record_id):
        customer = get_customer_or_404(self.db, self.customer_id)
        if name == "get_customer_churn_risk":
            return self._churn()
        if name == "get_customer_summary":
            return {
                "customer_id": str(customer.id),
                "is_active": customer.is_active,
                "created_at": customer.created_at,
                "updated_at": customer.updated_at,
                "ownership": "shared_workspace",
            }, 1
        if name == "get_customer_analysis_history":
            data, count = {}, 0
            for task in ("classification", "segmentation"):
                page = v1_data.history(self.db, self.customer_id, task, 0, 5, None)
                names = [
                    "id",
                    "model_id",
                    "model_version",
                    "created_at",
                    "purchase_level",
                    "probability_low",
                    "probability_medium",
                    "probability_high",
                    "cluster",
                    "segment_id",
                    "distance_to_centroid",
                ]
                data[task] = {
                    "total": page["total"],
                    "latest": [pick(item, names) for item in page["items"]],
                }
                count += len(page["items"])
            page = what_if_storage.history(
                self.db, WhatIfHistoryQuery(customer_id=self.customer_id, limit=5)
            )
            data["what_if"] = {
                "total": page["total"],
                "latest": [
                    pick(
                        item,
                        [
                            "scenario_id",
                            "created_at",
                            "models",
                            "baseline_label",
                            "scenario_label",
                            "integrity_status",
                        ],
                    )
                    for item in page["items"]
                ],
            }
            return data, count + len(page["items"])
        if name == "get_whatif_details":
            row = self.db.scalar(
                select(PredictionScenario).where(
                    PredictionScenario.id == record_id,
                    PredictionScenario.customer_id == self.customer_id,
                )
            )
            if row is None:
                raise HTTPException(404)
            comparison = what_if_storage.detail(self.db, record_id)["comparison"]
            data = {
                "scenario_id": str(record_id),
                "scope": "snapshot_input_sensitivity_not_causal_or_future",
            }
            for side in ("baseline", "scenario"):
                result = (
                    comparison["baseline"]
                    if side == "baseline"
                    else {
                        "classification": comparison["scenario_classification"],
                        "segmentation": comparison["scenario_segmentation"],
                    }
                )
                data[side] = {}
                for task in ("classification", "segmentation"):
                    outcome = result.get(task)
                    if outcome:
                        data[side][task] = pick(
                            outcome,
                            [
                                "purchase_level",
                                "probabilities",
                                "cluster",
                                "segment_id",
                                "distance_to_centroid",
                            ],
                        )
                        data[side][task]["model"] = pick(
                            outcome["model"], ["model_id", "model_version"]
                        )
            data["changed_fields"] = comparison["changed_fields"]
            data["probability_deltas"] = comparison["probability_deltas"]
            return data, 1
        cls = (
            PredictionResult if name == "get_prediction_details" else SegmentationResult
        )
        row = self.db.execute(
            select(cls, MLModel)
            .join(MLModel, MLModel.id == cls.model_id)
            .where(cls.id == record_id, cls.customer_id == self.customer_id)
        ).first()
        if row is None:
            raise HTTPException(404)
        result, model = row
        names = (
            [
                "id",
                "created_at",
                "purchase_level",
                "probability_low",
                "probability_medium",
                "probability_high",
            ]
            if cls is PredictionResult
            else ["id", "created_at", "cluster", "distance_to_centroid"]
        )
        data = dict(
            **{key: getattr(result, key) for key in names},
            model_id=model.name,
            model_version=model.version,
        )
        if cls is SegmentationResult:
            data["segment_id"] = (
                f"legacy:1.0.0:cluster:{result.cluster}"
                if model.version == "1.0.0"
                else model.metadata_json.get("segment_ids", {}).get(str(result.cluster))
            )
        return data, 1
