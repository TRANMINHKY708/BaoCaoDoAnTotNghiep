"""F11 report adapter to F06 renderers; verified server data only."""

from backend.services.report_data import report, section
from src.segmentation.pipeline import FEATURES

LABELS = {
    "customers": "Khách hàng duy nhất",
    "snapshots": "Snapshot hợp lệ",
    "import_jobs": "Lô nhập",
    "analysis_jobs": "Tác vụ phân tích",
    "analyzed_customers": "Khách có kết quả đã lưu",
    "stored_results": "Kết quả ML đã lưu duy nhất",
    "successful_items": "Lượt xử lý thành công",
    "preview_success_items": "Lượt thành công không lưu đầu ra",
    "failed_items": "Dòng xử lý thất bại",
    "skipped_items": "Dòng bỏ qua",
    "queued_items": "Dòng chưa xử lý",
    "failed_jobs": "Tác vụ có lỗi",
}


def document(data):
    doc = report("Báo cáo phân tích khách hàng hàng loạt", "batch_analytics")
    doc["metadata"] = [
        ("Nguồn", "PostgreSQL — F09/F10, workspace chung, chỉ đọc"),
        ("Mốc đọc (TP.HCM)", data["as_of"]),
        ("Múi giờ biểu đồ", "Asia/Ho_Chi_Minh (UTC+7)"),
        ("Số dòng trong bộ lọc", data["total_rows"]),
        (
            "Nguồn khai báo khi nhập",
            ", ".join(data.get("data_origins", [])) or "Chưa có thông tin",
        ),
    ]
    doc["metadata"].extend(
        (
            {
                "date_from": "Từ thời điểm (TP.HCM)",
                "date_to": "Đến thời điểm (TP.HCM, không gồm)",
            }.get(key, key),
            str(value),
        )
        for key, value in data["filters"].items()
        if value is not None
    )
    doc["sections"] = [
        section(
            "Chỉ số",
            ["Chỉ số", "Số lượng", "Định nghĩa"],
            [
                [LABELS.get(key, key), value, data["definitions"].get(key, "")]
                for key, value in data["kpis"].items()
            ],
        ),
        section(
            "Phiên bản mô hình",
            ["Bài toán", "Phiên bản", "Artifact SHA256", "Metadata SHA256"],
            [
                [
                    m["task"],
                    m["model_version"],
                    m["artifact_sha256"],
                    m["metadata_sha256"],
                ]
                for m in data["models"]
            ],
        ),
        section(
            "Mức độ mua hàng",
            ["Purchase_Level", "Số kết quả", "Tỷ lệ %"],
            [
                [r["label"], r["count"], r["share_percent"]]
                for r in data["purchase_distribution"]
            ],
        ),
        section(
            "Phân nhóm",
            ["Cluster ID", "Tên theo mô hình", "Số kết quả", "Tỷ lệ %"],
            [
                [r["cluster"], r["segment_name"], r["count"], r["share_percent"]]
                for r in data["cluster_distribution"]
            ],
        ),
    ]
    doc["sections"].append(
        section(
            "Hành vi theo nhóm",
            [
                "Cluster",
                "Số snapshot",
                "Đặc trưng",
                "Trung bình gốc",
                "Trung bình toàn phạm vi",
            ],
            [
                [
                    p["cluster"],
                    p["records"],
                    feature,
                    p["means"][feature],
                    data["overall_means"][feature],
                ]
                for p in data["cluster_profiles"]
                for feature in FEATURES
            ],
        )
    )
    doc["sections"].append(
        section(
            "Tác vụ theo ngày",
            ["Ngày Việt Nam", "Số tác vụ", "Tác vụ có lỗi"],
            [[r["day"], r["analysis_jobs"], r["failed_jobs"]] for r in data["trend"]],
        )
    )
    # Split narrow A4 tables by task; link columns retain exact IDs without guessing pairs.
    for task, title in (
        ("classification", "Dự đoán đã lưu"),
        ("segmentation", "Phân nhóm đã lưu"),
    ):
        selected = [r for r in data["rows"] if r["task"] == task and r["saved"]]
        doc["sections"].append(
            section(
                title,
                ["Khách hàng", "Snapshot", "Phiên bản", "Kết quả", "Thời điểm TP.HCM"],
                [
                    [
                        r["external_id"],
                        r["snapshot_id"],
                        r["model_version"],
                        r["purchase_level"]
                        if task == "classification"
                        else f"{r['cluster']}: {r['segment_name']}",
                        r["result_created_at"],
                    ]
                    for r in selected
                ],
            )
        )
        doc["sections"].append(
            section(
                "Chi tiết xác suất"
                if task == "classification"
                else "Chi tiết khoảng cách",
                ["Snapshot", "Low", "Medium", "High"]
                if task == "classification"
                else ["Snapshot", "Khoảng cách chuẩn hóa, không phải xác suất"],
                [
                    [
                        r["snapshot_id"],
                        *[
                            r["probabilities"][name]
                            for name in ("Low", "Medium", "High")
                        ],
                    ]
                    if task == "classification"
                    else [r["snapshot_id"], r["distance_to_centroid"]]
                    for r in selected
                ],
            )
        )
    doc["sections"].append(
        section(
            "Truy vết các dòng",
            [
                "Khách hàng UUID",
                "Snapshot UUID",
                "Lô nhập",
                "Tác vụ",
                "Trạng thái / số tham chiếu",
            ],
            [
                [
                    r["customer_id"],
                    r["snapshot_id"],
                    r["import_job_id"],
                    r["analysis_job_id"],
                    f"{r['item_status']}; saved={r['saved']}; references={r['reference_count']}; {r['error_code'] or ''}",
                ]
                for r in data["rows"]
            ],
        )
    )
    doc["notes"].extend(data["warnings"])
    doc["notes"].append(
        "Xác suất trong bảng chi tiết có đơn vị 0–1. Không kèm nhận xét AI chưa xác minh; xuất báo cáo không gọi Gemini."
    )
    return doc
