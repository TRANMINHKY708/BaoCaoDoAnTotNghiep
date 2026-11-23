"""Whitelisted report data from server receipts or one scoped read-only DB view."""

from datetime import UTC, datetime

from sqlalchemy import select, text

from backend.core.account_permissions import permitted
from backend.models.ml import MLModel
from backend.models.prediction import PredictionResult, SegmentationResult
from backend.models.scenario import PredictionScenario
from backend.schemas.customer import BehaviorSnapshotRead, CustomerRead
from backend.schemas.reports import reference_uuid
from backend.schemas.what_if import WhatIfHistoryQuery
from backend.services import v1_data, what_if_storage
from backend.services.customer_service import get_customer_or_404
from backend.services.narrative_receipts import receipts
from backend.services.versioned_models import failure

NOTE = "Phân tích dữ liệu snapshot, không chứng minh nhân quả hoặc dự báo chắc chắn giao dịch tương lai. SHAP dùng raw margin, không phải phần trăm xác suất. Khoảng cách K-Means không phải xác suất hay confidence; cluster ID không là thứ hạng."


def section(title, headers, rows):
    return {
        "title": title,
        "headers": headers,
        "rows": rows or [["Chưa có dữ liệu"] + [None] * (len(headers) - 1)],
    }


def report(title, kind):
    return {
        "title": title,
        "kind": kind,
        "created_at": datetime.now(UTC),
        "metadata": [],
        "sections": [],
        "notes": [NOTE],
        "ai": None,
        "summary": "Báo cáo chỉ tổng hợp dữ liệu đã xác minh trong phạm vi nguồn nêu trên. Thông tin thiếu không được suy diễn hoặc thay bằng số 0.",
    }


def require(ctx, caps):
    if not permitted(ctx["user"], caps):
        failure(403, "FORBIDDEN", "Tài khoản không có quyền xuất nguồn dữ liệu này.")


def analysis_sections(value, metadata=None):
    data, kind = value["data"], value["kind"]
    out = report(
        {
            "prediction": "Báo cáo dự đoán mức độ mua hàng",
            "segmentation": "Báo cáo phân nhóm khách hàng",
            "what_if": "Báo cáo mô phỏng thay đổi hành vi",
        }[kind],
        kind,
    )
    meta = {**value.get("_export", {}), **(metadata or {})}
    out["metadata"] = [
        ("Nguồn dữ liệu", value.get("source", "PostgreSQL - kết quả đã lưu")),
        ("Thời điểm phân tích (TP.HCM)", meta.get("generated_at")),
        ("Khách hàng", meta.get("customer_id")),
        ("Snapshot", meta.get("snapshot_id")),
    ]
    out["notes"].append(
        "Chưa có liên kết khách hàng/snapshot được xác minh nếu thông tin tương ứng để trống."
    )
    if value.get("source") == "verified_live_backend_result":
        out["notes"].append(
            "Nguồn là kết quả vừa phân tích; receipt không xác nhận kết quả đã lưu vào lịch sử."
        )
    if kind == "prediction":
        out["summary"] = (
            f"Nhãn Purchase_Level do mô hình trả về là {data.get('purchase_level', 'chưa có dữ liệu')}. Đây là phân loại từ snapshot, không phải cam kết hành vi mua hàng tương lai."
        )
        add_prediction(out, data, "Dự đoán")
        exp = meta.get("explanation")
        if exp:
            out["sections"].append(
                section(
                    "Giải thích SHAP",
                    ["Thông tin", "Giá trị"],
                    [
                        ["Không gian", exp["output_space"]],
                        ["Base value", exp["base_value"]],
                        ["Đầu ra mô hình", exp["model_output"]],
                    ],
                )
            )
            out["sections"].append(
                section(
                    "Đóng góp SHAP",
                    ["Đặc trưng sau tiền xử lý", "Giá trị", "SHAP (raw margin)"],
                    [
                        [f["feature_name"], f["feature_value"], f["shap_value"]]
                        for f in exp["features"]
                    ],
                )
            )
        else:
            out["notes"].append(
                "Chưa có giải thích SHAP được tính/lưu cho kết quả này; báo cáo không tự tính thêm."
            )
    elif kind == "segmentation":
        out["summary"] = (
            f"Kết quả thuộc Cluster ID {data.get('cluster', 'chưa có dữ liệu')}. Chỉ diễn giải trong phiên bản mô hình tương ứng; ID không phải thứ hạng hay xác suất."
        )
        add_segment(out, data, "Phân nhóm")
        out["notes"].append(
            "Kết quả phân nhóm không kèm giá trị hành vi cá nhân để tái dựng hồ sơ. Hồ sơ đặc trưng nghiên cứu chỉ được thêm khi yêu cầu và tương thích; không dùng trung bình cụm thay cho dữ liệu cá nhân."
        )
    else:
        add_prediction(out, data["baseline"], "Baseline")
        if data.get("baseline_segmentation"):
            add_segment(out, data["baseline_segmentation"], "Cụm ban đầu")
        if data.get("scenario"):
            out["summary"] = (
                f"Purchase_Level baseline là {data['baseline'].get('purchase_level')}; sau điều chỉnh là {data['scenario'].get('purchase_level')}. Sự khác biệt mô tả phản ứng của mô hình, không chứng minh tác động nhân quả."
            )
            add_prediction(out, data["scenario"], "Kịch bản")
            changes = data.get("changes", [])
            out["sections"].append(
                section(
                    "Biến đã điều chỉnh",
                    ["Đặc trưng", "Trước", "Sau"],
                    [[c["feature"], c["before"], c["after"]] for c in changes],
                )
            )
            pp = data.get("probability_deltas", {}).get("percentage_points", {})
            out["sections"].append(
                section(
                    "Chênh lệch xác suất",
                    ["Lớp", "Chênh lệch (điểm %)"],
                    [[name, pp.get(name)] for name in ("Low", "Medium", "High")],
                )
            )
            if data.get("scenario_segmentation"):
                add_segment(out, data["scenario_segmentation"], "Cụm kịch bản")
        else:
            out["notes"].append("Mới có baseline, chưa có kết quả so sánh kịch bản.")
        if meta.get("baseline_input"):
            out["sections"].append(
                section(
                    "Đầu vào baseline",
                    ["Đặc trưng", "Giá trị"],
                    list(meta["baseline_input"].items()),
                )
            )
    return out


def add_prediction(out, data, title):
    out["sections"].append(
        section(
            title,
            ["Thông tin", "Giá trị"],
            [
                ["Mô hình", data.get("model_id")],
                ["Phiên bản", data.get("model_version")],
                ["Purchase_Level", data.get("purchase_level")],
            ],
        )
    )
    probs = data.get("probabilities", {})
    out["sections"].append(
        section(
            title + " - xác suất",
            ["Lớp", "Xác suất"],
            [[name, probs.get(name)] for name in ("Low", "Medium", "High")],
        )
    )


def add_segment(out, data, title):
    out["sections"].append(
        section(
            title,
            ["Thông tin", "Giá trị"],
            [
                ["Mô hình", data.get("model_id")],
                ["Phiên bản", data.get("model_version")],
                ["Cluster ID", data.get("cluster")],
                ["Segment ID", data.get("segment_id")],
                ["Khoảng cách chuẩn hóa", data.get("distance_to_centroid")],
            ],
        )
    )


def preview_report(payload, ctx):
    facts = receipts.resolve(ctx, payload.receipt)
    out = analysis_sections(facts)
    if payload.include_ai:
        saved = receipts.narrative_for_export(ctx, payload.receipt)
        if not saved or saved["result_fingerprint"] != facts["fingerprint"]:
            failure(
                409,
                "REPORT_AI_UNAVAILABLE",
                "Chưa có nhận xét AI đã xác minh. Hãy tạo nhận xét trước hoặc bỏ tùy chọn kèm AI.",
            )
        out["ai"] = saved["narrative"]
        out["metadata"].append(("Thời điểm nhận xét AI (TP.HCM)", saved["generated_at"]))
    if payload.include_research:
        if facts["kind"] != "segmentation":
            failure(
                422,
                "REPORT_RESEARCH_NOT_APPLICABLE",
                "Hồ sơ nghiên cứu chỉ dùng cho báo cáo phân nhóm.",
            )
        from backend.services.segmentation_profiles import research_profiles

        p = research_profiles(facts["data"]["model_version"])
        if (
            p["artifact_sha256"] != facts["data"]["artifact_sha256"]
            or p["model_version"] != facts["data"]["model_version"]
        ):
            failure(
                409,
                "REPORT_RESEARCH_INCOMPATIBLE",
                "Hồ sơ nghiên cứu không tương thích với kết quả này.",
            )
        selected = next(
            (c for c in p["clusters"] if c["cluster_id"] == facts["data"]["cluster"]),
            None,
        )
        if selected is None:
            failure(
                409,
                "REPORT_RESEARCH_INCOMPATIBLE",
                "Chưa có hồ sơ nghiên cứu của cụm này.",
            )
        out["sections"].append(
            section(
                "Hồ sơ nghiên cứu F02",
                ["Thông tin", "Giá trị"],
                [
                    ["Nguồn", p["source"]],
                    ["Thời điểm tính (TP.HCM)", p["computed_at"]],
                    ["Phiên bản", p["model_version"]],
                    ["Bản ghi nghiên cứu sử dụng", p["records_used"]],
                    ["Bản ghi của cụm", selected["record_count"]],
                    ["Tỷ lệ trong dataset (%)", selected["share_percent"]],
                ],
            )
        )
        out["sections"].append(
            section(
                "Đặc trưng nghiên cứu",
                ["Đặc trưng", "Trung bình cụm", "Số quan sát", "Trung bình dataset"],
                [
                    [
                        name,
                        stats["mean"],
                        stats["observed_count"],
                        p["overall"][name]["mean"],
                    ]
                    for name, stats in selected["features"].items()
                ],
            )
        )
        out["notes"].append(
            "Hồ sơ F02 mô tả dataset nghiên cứu đã làm sạch, không phải thống kê khách hàng PostgreSQL hoặc đặc điểm chắc chắn của cá nhân. Trung bình theo đơn vị gốc; đơn vị chưa được xác minh không tự gán."
        )
    return out


def customer_report(payload, ctx, db):
    require(ctx, ["customers.read", "history.read"])
    cid = reference_uuid(payload.customer_id)
    out = report("Hồ sơ phân tích khách hàng", "customer")
    db.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"))
    db.execute(text("SET LOCAL statement_timeout = '3000ms'"))
    try:
        customer = CustomerRead.model_validate(get_customer_or_404(db, cid)).model_dump(
            mode="json"
        )
        out["metadata"] = [
            ("Nguồn", "PostgreSQL - một khách hàng"),
            ("Khách hàng", customer["id"]),
            ("Mã hồ sơ", customer["external_id"]),
            ("Đang hoạt động", customer["is_active"]),
            ("Ngày tạo (TP.HCM)", customer["created_at"]),
        ]
        snapshots = v1_data.behaviors(db, cid, 0, payload.limit)
        out["sections"].append(
            section(
                "Snapshot hành vi",
                ["Snapshot", "Thời điểm (TP.HCM)", "Đặc trưng", "Giá trị"],
                [
                    [str(row.id), row.captured_at, key, value]
                    for row in snapshots["items"]
                    for key, value in BehaviorSnapshotRead.model_validate(row)
                    .model_dump(by_alias=True)
                    .items()
                    if key not in {"id", "customer_id", "captured_at"}
                ],
            )
        )
        counts = [("Snapshot", len(snapshots["items"]), snapshots["total"])]
        for task, title in (
            ("classification", "Lịch sử dự đoán"),
            ("segmentation", "Lịch sử phân nhóm"),
        ):
            page = v1_data.history(db, cid, task, 0, payload.limit, None)
            counts.append((title, len(page["items"]), page["total"]))
            if task == "classification":
                headers = [
                    "Thời điểm (TP.HCM)",
                    "Phiên bản",
                    "Purchase_Level",
                    "Xác suất Low",
                    "Xác suất Medium",
                    "Xác suất High",
                    "Snapshot",
                ]
                rows = [
                    [
                        r.created_at,
                        r.model_version,
                        r.purchase_level,
                        r.probability_low,
                        r.probability_medium,
                        r.probability_high,
                        r.behavior_snapshot_id,
                    ]
                    for r in page["items"]
                ]
            else:
                headers = [
                    "Thời điểm (TP.HCM)",
                    "Phiên bản",
                    "Cluster ID",
                    "Segment ID",
                    "Khoảng cách",
                    "Snapshot",
                ]
                rows = [
                    [
                        r.created_at,
                        r.model_version,
                        r.cluster,
                        r.segment_id,
                        r.distance_to_centroid,
                        r.behavior_snapshot_id,
                    ]
                    for r in page["items"]
                ]
            out["sections"].append(section(title, headers, rows))
        page = what_if_storage.history(
            db, WhatIfHistoryQuery(customer_id=cid, limit=payload.limit)
        )
        counts.append(("Lịch sử What-if", len(page["items"]), page["total"]))
        out["sections"].append(
            section(
                "Lịch sử What-if",
                [
                    "Kịch bản",
                    "Tên",
                    "Thời điểm (TP.HCM)",
                    "Baseline",
                    "Sau thay đổi",
                    "Toàn vẹn",
                ],
                [
                    [
                        r["scenario_id"],
                        r["name"],
                        r["created_at"],
                        r["baseline_label"],
                        r["scenario_label"],
                        r["integrity_status"],
                    ]
                    for r in page["items"]
                ],
            )
        )
        out["sections"].insert(
            0, section("Phạm vi xuất", ["Nguồn", "Đã xuất", "Tổng hiện có"], counts)
        )
        out["notes"].append(
            f"Lấy tối đa {payload.limit} bản ghi mới nhất mỗi nguồn, trong cùng transaction chỉ đọc. Không gọi tập con là toàn bộ lịch sử; chỉ xuất dữ liệu của khách hàng nêu trên. SHAP/nhận xét AI chưa lưu không nằm trong lịch sử PostgreSQL."
        )
        return out
    finally:
        db.rollback()


def stored_report(payload, ctx, db):
    require(ctx, ["customers.read", "history.read"])
    cid, rid = reference_uuid(payload.customer_id), reference_uuid(payload.record_id)
    db.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"))
    db.execute(text("SET LOCAL statement_timeout = '3000ms'"))
    try:
        get_customer_or_404(db, cid)
        if payload.kind == "what_if":
            row = db.scalar(
                select(PredictionScenario).where(
                    PredictionScenario.id == rid, PredictionScenario.customer_id == cid
                )
            )
            if row is None:
                failure(
                    404,
                    "REPORT_RECORD_NOT_FOUND",
                    "Không tìm thấy bản ghi của khách hàng này.",
                )
            detail = what_if_storage.detail(db, rid)
            from backend.services.narrative_receipts import project

            facts = project("/api/v1/what-if", detail["comparison"])
            return analysis_sections(
                facts,
                {
                    "generated_at": detail["created_at"],
                    "customer_id": cid,
                    "snapshot_id": row.baseline_snapshot_id,
                },
            )
        cls = PredictionResult if payload.kind == "prediction" else SegmentationResult
        pair = db.execute(
            select(cls, MLModel)
            .join(MLModel, cls.model_id == MLModel.id)
            .where(
                cls.id == rid,
                cls.customer_id == cid,
                MLModel.task
                == (
                    "classification" if payload.kind == "prediction" else "segmentation"
                ),
            )
        ).first()
        if pair is None:
            failure(
                404,
                "REPORT_RECORD_NOT_FOUND",
                "Không tìm thấy bản ghi của khách hàng này.",
            )
        row, model = pair
        data = {"model_id": model.name, "model_version": model.version}
        if payload.kind == "prediction":
            data.update(
                purchase_level=row.purchase_level,
                probabilities={
                    "Low": row.probability_low,
                    "Medium": row.probability_medium,
                    "High": row.probability_high,
                },
            )
        else:
            data.update(
                cluster=row.cluster,
                distance_to_centroid=row.distance_to_centroid,
                segment_id=f"legacy:1.0.0:cluster:{row.cluster}"
                if model.version == "1.0.0"
                else model.metadata_json.get("segment_ids", {}).get(str(row.cluster)),
            )
        return analysis_sections(
            {"kind": payload.kind, "data": data},
            {
                "generated_at": row.created_at,
                "customer_id": cid,
                "snapshot_id": row.behavior_snapshot_id,
            },
        )
    finally:
        db.rollback()
