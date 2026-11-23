"""Pure deterministic rules over verified F11 aggregates; no I/O or inference."""

import hashlib
import itertools
import json
import math
from decimal import ROUND_HALF_UP, Decimal, localcontext

from backend.schemas.batch_analytics import BatchView
from backend.schemas.insights import InsightEnvelope, InsightModel
from backend.services.versioned_models import failure

VERSION = "1.0.0"
FEATURES = {
    "Login_Frequency": (
        "Tần suất đăng nhập",
        "lượt đăng nhập",
        "source_period_unknown",
    ),
    "Session_Duration_Avg": (
        "Thời lượng phiên trung bình",
        "đơn vị thời lượng nguồn",
        "unverified",
    ),
    "Pages_Per_Session": ("Số trang mỗi phiên", "trang/phiên", "source_contract"),
    "Cart_Abandonment_Rate": ("Tỷ lệ bỏ giỏ hàng", "%", "source_contract"),
    "Wishlist_Items": ("Sản phẩm yêu thích", "sản phẩm", "source_contract"),
    "Total_Purchases": ("Số lượt mua ghi nhận", "lượt mua", "source_contract"),
    "Average_Order_Value": (
        "Giá trị đơn trung bình",
        "đơn vị tiền tệ nguồn",
        "unverified",
    ),
    "Days_Since_Last_Purchase": (
        "Thời gian từ lần mua gần nhất",
        "ngày",
        "source_contract",
    ),
    "Discount_Usage_Rate": ("Tỷ lệ dùng giảm giá", "%", "source_contract"),
    "Mobile_App_Usage": ("Mức sử dụng ứng dụng", "đơn vị nguồn", "unverified"),
}
REASONS = {
    "NO_SAVED_RESULTS": "Chưa có kết quả đã lưu trong phạm vi này.",
    "NO_SEGMENTATION_RESULTS": "Chưa có kết quả phân nhóm đã lưu.",
    "NO_CLASSIFICATION_RESULTS": "Chưa có kết quả mức mua đã lưu.",
    "ONE_ELIGIBLE_GROUP": "Chỉ có một nhóm có trung bình hợp lệ để so sánh.",
    "MISSING_FEATURE": "Nhóm chưa cung cấp đặc điểm đang chọn.",
    "NULL_MEAN": "Chưa có giá trị trung bình cho đặc điểm đang chọn.",
    "NONFINITE_MEAN": "Giá trị trung bình không hữu hạn; không dùng để so sánh.",
    "INSUFFICIENT_SOURCE_RECORDS": "Chưa đủ bản ghi theo chính sách hiển thị trung bình.",
    "EFFECTIVE_COUNT_NOT_EXPOSED": "Nguồn chưa cung cấp số mẫu hữu hiệu và số giá trị thiếu theo đặc điểm.",
    "NO_OVERALL_MEAN": "Chưa có trung bình toàn phạm vi cho đặc điểm đang chọn.",
}


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def display_value(value):
    """12 significant digits, half-up, matching Intl's display tie policy."""
    with localcontext() as ctx:
        ctx.prec = 340
        number = Decimal(str(value))
        if not number:
            return "0"
        rounded = number.quantize(
            Decimal(1).scaleb(number.adjusted() - 11), rounding=ROUND_HALF_UP
        )
        return (
            format(rounded, "f").rstrip("0").rstrip(".")
            if rounded.as_tuple().exponent < 0
            else format(rounded, "f")
        )


def formatted(value):
    return display_value(value).replace(".", ",")


def integrity():
    failure(
        409,
        "BATCH_DATA_INTEGRITY",
        "Số liệu nguồn chưa nhất quán; hãy tải lại dữ liệu.",
    )


def evaluate(raw, feature_key=None):
    """Caller must read/verify fingerprint in the same read-only transaction."""
    data = BatchView.model_validate(raw).model_dump()
    if feature_key is not None and feature_key not in FEATURES:
        raise ValueError("Unsupported feature")
    models = {}
    for model in data["models"]:
        parsed = InsightModel.model_validate(
            {
                k: model[k]
                for k in ("task", "model_version", "artifact_sha256", "metadata_sha256")
            }
        ).model_dump()
        task = parsed["task"]
        if task in models and models[task] != parsed:
            failure(
                409,
                "BATCH_MODEL_IDENTITY_AMBIGUOUS",
                "Phạm vi chứa nhiều danh tính mô hình.",
            )
        prefix = "classification" if task == "classification" else "segmentation"
        filters = data["filters"]
        if parsed["model_version"] != filters[prefix + "_version"]:
            integrity()
        for suffix, key in (
            ("artifact", "artifact_sha256"),
            ("metadata", "metadata_sha256"),
        ):
            if (
                filters[prefix + "_" + suffix]
                and filters[prefix + "_" + suffix] != parsed[key]
            ):
                integrity()
        models[task] = parsed
    fingerprint = data["fingerprint"]
    insights, evaluations = [], []

    def evaluation(rule, parameters, reason=None):
        evaluations.append(
            {
                "rule_id": rule,
                "rule_version": VERSION,
                "status": "skipped" if reason else "emitted",
                "reason_code": reason,
                "parameters": parameters,
            }
        )

    def emit(
        rule,
        params,
        title,
        description,
        task,
        section,
        observations,
        *,
        derived=None,
        counts=None,
        limitations=None,
        feature=None,
        availability=False,
    ):
        identity = models.get(task)
        evidences, values = [], []
        for index, (metric, value, unit, selector, field, cluster) in enumerate(
            observations
        ):
            eid = f"source-{index}"
            evidences.append(
                {
                    "evidence_id": eid,
                    "source_field": field,
                    "semantic_selector": selector,
                    "observed_value": value,
                    "source_fingerprint": fingerprint,
                }
            )
            kind = (
                "null"
                if value is None
                else "nonnegative_integer"
                if type(value) is int and value >= 0
                else "finite_number"
                if finite(value)
                else "string"
            )
            if metric == "share_percent":
                kind = "percentage_0_100"
            values.append(
                {
                    "metric": metric,
                    "value": value,
                    "value_type": kind,
                    "unit": unit,
                    "cluster_id": cluster,
                    "evidence_id": eid,
                }
            )
        unit = None
        if feature:
            _, label, verification = FEATURES[feature]
            unit = {
                "kind": "percentage_0_100" if label == "%" else "raw_source",
                "label": label,
                "verification_status": verification,
            }
        insight_id = hashlib.sha256(
            json.dumps(
                [fingerprint, VERSION, rule, VERSION, params],
                sort_keys=True,
                separators=(",", ":"),
            ).encode()
        ).hexdigest()
        insights.append(
            {
                "insight_id": insight_id,
                "rule_id": rule,
                "rule_version": VERSION,
                "insight_type": "data_availability"
                if availability
                else "derived_comparison"
                if derived
                else "observed_fact",
                "title": title,
                "description": description,
                "model_identity": identity,
                "feature_key": feature,
                "unit": unit,
                "observed_values": values,
                "derived_values": derived or [],
                "sample_counts": counts or [],
                "evidence": evidences,
                "limitations": limitations or [],
                "navigation_target": {"section": section, "feature_key": feature},
            }
        )
        evaluation(rule, params)

    def available(
        code,
        task=None,
        feature=None,
        selector=None,
        value=None,
        field="kpis.stored_results",
    ):
        params = {
            "reason": code,
            "task": task,
            "feature_key": feature,
            "selector": selector or {},
        }
        emit(
            "DATA_AVAILABILITY",
            params,
            "Phạm vi dữ liệu",
            REASONS[code],
            task,
            "comparison" if feature else "results",
            [
                (
                    code,
                    value,
                    "metadata"
                    if code == "EFFECTIVE_COUNT_NOT_EXPOSED"
                    else "trạng thái nguồn",
                    selector or {},
                    field,
                    None,
                )
            ],
            availability=True,
            feature=feature,
            limitations=[{"code": code, "description": REASONS[code]}],
        )

    totals = {}
    for task, field, rule, section in (
        (
            "segmentation",
            "cluster_distribution",
            "SEGMENT_RESULT_SHARE",
            "segment_distribution",
        ),
        (
            "classification",
            "purchase_distribution",
            "PURCHASE_RESULT_SHARE",
            "purchase_distribution",
        ),
    ):
        rows = data[field]
        key = "cluster" if task == "segmentation" else "label"
        seen = set()
        for row in rows:
            if row[key] in seen or (
                row[key] not in (0, 1, 2)
                if task == "segmentation"
                else row[key] not in ("Low", "Medium", "High")
            ):
                integrity()
            seen.add(row[key])
            if type(row["count"]) is not int or row["count"] < 0:
                integrity()
        total = sum(r["count"] for r in rows)
        totals[task] = total
        if not total:
            if rows and any(r["share_percent"] != 0 for r in rows):
                integrity()
            available(
                "NO_SEGMENTATION_RESULTS"
                if task == "segmentation"
                else "NO_CLASSIFICATION_RESULTS",
                task,
                value=total,
                field=field,
            )
            evaluation(rule, {}, "ZERO_DENOMINATOR")
            continue
        if task not in models:
            integrity()
        for row in sorted(
            rows,
            key=lambda r: (
                r[key]
                if task == "segmentation"
                else ("Low", "Medium", "High").index(r[key])
            ),
        ):
            share = row["share_percent"]
            if (
                not finite(share)
                or not 0 <= share <= 100
                or not math.isclose(
                    share, 100 * row["count"] / total, rel_tol=1e-12, abs_tol=1e-12
                )
            ):
                integrity()
            selector = dict(task=task, **{key: row[key]})
            name = f"Nhóm {row[key]}" if task == "segmentation" else row[key]
            unit = (
                "kết quả phân nhóm đã lưu"
                if task == "segmentation"
                else "kết quả mức mua đã lưu"
            )
            emit(
                rule,
                selector,
                "Phân bố kết quả phân nhóm"
                if task == "segmentation"
                else "Phân bố mức mua",
                f"{name}: {row['count']} / {total} {unit} ({formatted(share)}%).",
                task,
                section,
                [
                    (
                        "count",
                        row["count"],
                        unit,
                        selector,
                        field + ".count",
                        row[key] if task == "segmentation" else None,
                    ),
                    (
                        "denominator",
                        total,
                        unit,
                        {"task": task},
                        field + ".sum(count)",
                        None,
                    ),
                    (
                        "share_percent",
                        share,
                        "%",
                        selector,
                        field + ".share_percent",
                        None,
                    ),
                ],
                counts=[
                    {
                        "value": row["count"],
                        "unit": unit,
                        "scope": "bucket_in_applied_filters",
                        "evidence_id": "source-0",
                    },
                    {
                        "value": total,
                        "unit": unit,
                        "scope": "task_in_applied_filters",
                        "evidence_id": "source-1",
                    },
                ],
                limitations=[
                    {
                        "code": "RESULTS_NOT_CUSTOMERS",
                        "description": "Đếm kết quả đã lưu, không phải khách hàng duy nhất, độ chính xác hoặc xác suất mua tương lai.",
                    }
                ],
            )
    if sum(totals.values()) != data["kpis"]["stored_results"]:
        integrity()
    if not sum(totals.values()):
        available("NO_SAVED_RESULTS", value=0)

    if feature_key and totals["segmentation"]:
        feature = feature_key
        title, unit, _ = FEATURES[feature]
        profiles = sorted(data["cluster_profiles"], key=lambda r: r["cluster"])
        distribution = {r["cluster"]: r["count"] for r in data["cluster_distribution"]}
        if len({p["cluster"] for p in profiles}) != len(profiles) or {
            p["cluster"] for p in profiles
        } != set(distribution):
            integrity()
        eligible = []
        available(
            "EFFECTIVE_COUNT_NOT_EXPOSED",
            "segmentation",
            feature,
            field="feature_effective_counts",
        )
        for p in profiles:
            if (
                type(p["records"]) is not int
                or p["records"] != distribution[p["cluster"]]
            ):
                integrity()
            value = p["means"].get(feature)
            reason = (
                "INSUFFICIENT_SOURCE_RECORDS"
                if p["status"] != "available" or p["records"] < 2
                else "MISSING_FEATURE"
                if feature not in p["means"]
                else "NULL_MEAN"
                if value is None
                else "NONFINITE_MEAN"
                if not finite(value)
                else None
            )
            if reason:
                available(
                    reason,
                    "segmentation",
                    feature,
                    {"cluster": p["cluster"], "feature_key": feature},
                    value="non-finite" if reason == "NONFINITE_MEAN" else value,
                    field="cluster_profiles.means",
                )
                evaluation(
                    "MEAN_PAIR",
                    {"cluster": p["cluster"], "feature_key": feature},
                    reason,
                )
                continue
            if unit == "%" and not 0 <= value <= 100:
                integrity()
            eligible.append(p)
        if len(eligible) == 1:
            available(
                "ONE_ELIGIBLE_GROUP",
                "segmentation",
                feature,
                value=1,
                field="cluster_profiles.available_groups",
            )
        overall = data["overall_means"].get(feature)
        if not finite(overall):
            available(
                "NO_OVERALL_MEAN",
                "segmentation",
                feature,
                field="overall_means." + feature,
            )
        elif unit == "%" and not 0 <= overall <= 100:
            integrity()
        pairs = [("MEAN_PAIR", a, b) for a, b in itertools.combinations(eligible, 2)]
        pairs += (
            [("MEAN_VS_SCOPE", a, None) for a in eligible] if finite(overall) else []
        )
        for rule, a, b in pairs:
            av, bv = a["means"][feature], b["means"][feature] if b else overall
            params = {
                "feature_key": feature,
                "cluster_a": a["cluster"],
                "cluster_b": b["cluster"] if b else None,
            }
            reason = (
                "ALL_EQUAL"
                if av == bv
                else "DISPLAY_VALUES_EQUAL"
                if display_value(av) == display_value(bv)
                else None
            )
            delta = av - bv
            if reason or not finite(delta):
                evaluation(rule, params, reason or "NONFINITE_DIFFERENCE")
                continue
            delta_unit = "điểm phần trăm" if unit == "%" else unit
            target = f"nhóm {b['cluster']}" if b else "toàn phạm vi"
            limitations = [
                {
                    "code": "DESCRIPTIVE_ONLY",
                    "description": "So sánh mô tả; chưa có kiểm định, phương sai, số mẫu hữu hiệu hoặc quan hệ nhân quả.",
                }
            ]
            if not b:
                limitations.append(
                    {
                        "code": "SCOPE_INCLUDES_GROUP",
                        "description": "Trung bình toàn phạm vi bao gồm chính nhóm này; không phải nhóm đối chứng.",
                    }
                )
            obs = [
                (
                    "mean_a",
                    av,
                    unit,
                    {"cluster": a["cluster"], "feature_key": feature},
                    "cluster_profiles.means",
                    a["cluster"],
                ),
                (
                    "mean_b" if b else "scope_mean",
                    bv,
                    unit,
                    {"cluster": b["cluster"], "feature_key": feature}
                    if b
                    else {"feature_key": feature},
                    "cluster_profiles.means" if b else "overall_means",
                    b["cluster"] if b else None,
                ),
            ]
            counts = [
                {
                    "value": None,
                    "unit": "effective_count",
                    "scope": "feature_in_applied_filters",
                    "unavailable_reason": "not_exposed_by_source",
                },
                {
                    "value": None,
                    "unit": "missing_count",
                    "scope": "feature_in_applied_filters",
                    "unavailable_reason": "not_exposed_by_source",
                },
            ]
            for p in (a, b):
                if p:
                    eid = f"source-{len(obs)}"
                    obs.append(
                        (
                            "records",
                            p["records"],
                            "bản ghi kết quả phân nhóm",
                            {"cluster": p["cluster"]},
                            "cluster_profiles.records",
                            p["cluster"],
                        )
                    )
                    counts.append(
                        {
                            "value": p["records"],
                            "unit": "bản ghi kết quả phân nhóm",
                            "scope": f"cluster:{p['cluster']}",
                            "evidence_id": eid,
                        }
                    )
            emit(
                rule,
                params,
                title,
                f"Nhóm {a['cluster']}: {formatted(av)} {unit}; {target}: {formatted(bv)} {unit}. Chênh lệch nhóm {a['cluster']} − {target}: {formatted(delta)} {delta_unit}.",
                "segmentation",
                "comparison",
                obs,
                derived=[
                    {
                        "operation": "subtract",
                        "operands": ["source-0", "source-1"],
                        "value": delta,
                        "unit": delta_unit,
                    }
                ],
                counts=counts,
                limitations=limitations,
                feature=feature,
            )

    # Fixed rule/parameter ordering; timestamps never participate in identifiers.
    insights.sort(key=lambda r: (r["rule_id"], r["insight_id"]))
    evaluations.sort(
        key=lambda r: (r["rule_id"], json.dumps(r["parameters"], sort_keys=True))
    )
    return InsightEnvelope.model_validate(
        {
            "source": data["source"],
            "as_of": data["as_of"],
            "aggregate_fingerprint": fingerprint,
            "filter_scope": data["filters"],
            "resolved_models": [models[k] for k in sorted(models)],
            "status": "ready"
            if any(i["insight_type"] != "data_availability" for i in insights)
            else "no_eligible_facts",
            "insights": insights,
            "evaluations": evaluations,
        }
    )
