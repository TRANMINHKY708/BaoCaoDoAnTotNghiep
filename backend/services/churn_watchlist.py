"""K12: server-side churn watchlist for report export (same rules as the /churn page, nothing saved).

Active customers, newest first, at most MAX_CUSTOMERS; the latest snapshot of each one is scored by the
pinned churn model. Snapshots that already record churn are listed apart and never re-predicted.
"""

import re

from sqlalchemy import func, select, text

from backend.models.customer import Customer, CustomerBehaviorSnapshot
from backend.services.churn_model import churn_model
from backend.services.report_data import report, require, section
from src.training.churn_policy import MAIN_FEATURES

MAX_CUSTOMERS = 500
TOP_FACTORS = 3
LEVELS = {"high": "Cao", "medium": "Trung bình", "low": "Thấp"}
LABELS = {
    "Age": "Tuổi",
    "Gender": "Giới tính",
    "Country": "Quốc gia",
    "City": "Thành phố",
    "Membership_Years": "Số năm thành viên",
    "Login_Frequency": "Tần suất đăng nhập",
    "Session_Duration_Avg": "Thời lượng phiên trung bình",
    "Pages_Per_Session": "Số trang mỗi phiên",
    "Cart_Abandonment_Rate": "Tỷ lệ bỏ giỏ hàng",
    "Wishlist_Items": "Sản phẩm yêu thích",
    "Average_Order_Value": "Giá trị đơn trung bình",
    "Discount_Usage_Rate": "Tỷ lệ dùng giảm giá",
    "Returns_Rate": "Tỷ lệ hoàn trả",
    "Email_Open_Rate": "Tỷ lệ mở email",
    "Customer_Service_Calls": "Số cuộc gọi hỗ trợ",
    "Product_Reviews_Written": "Số đánh giá đã viết",
    "Social_Media_Engagement_Score": "Điểm tương tác mạng xã hội",
    "Mobile_App_Usage": "Mức dùng ứng dụng",
    "Payment_Method_Diversity": "Số phương thức thanh toán",
    "Credit_Balance": "Số dư tín dụng",
    "Signup_Quarter": "Quý đăng ký",
}
assert set(LABELS) == set(MAIN_FEATURES)


def vn(value, digits):
    """Vietnamese decimal comma, as in the rest of the reports' prose."""
    return f"{value:.{digits}f}".replace(".", ",")


def customer_code(value):
    """Same display alias as the web app (customerIdentity.ts): bulk:<sha256> -> KH-<10 hex>."""
    match = re.fullmatch(r"bulk:([a-fA-F0-9]{64})", value)
    return f"KH-{match.group(1)[:10].upper()}" if match else value


def latest_snapshots(db, limit=MAX_CUSTOMERS):
    """(customer, latest snapshot or None) for the newest active customers, plus the active total."""
    total = db.scalar(select(func.count(Customer.id)).where(Customer.is_active.is_(True))) or 0
    customers = list(
        db.scalars(
            select(Customer)
            .where(Customer.is_active.is_(True))
            .order_by(Customer.created_at.desc(), Customer.id)
            .limit(limit)
        )
    )
    if not customers:
        return [], total
    rank = (
        func.row_number()
        .over(
            partition_by=CustomerBehaviorSnapshot.customer_id,
            order_by=(CustomerBehaviorSnapshot.captured_at.desc(), CustomerBehaviorSnapshot.id.desc()),
        )
        .label("rank")
    )
    ranked = (
        select(CustomerBehaviorSnapshot.id, rank)
        .where(CustomerBehaviorSnapshot.customer_id.in_([c.id for c in customers]))
        .subquery()
    )
    latest = {
        s.customer_id: s
        for s in db.scalars(
            select(CustomerBehaviorSnapshot).join(ranked, ranked.c.id == CustomerBehaviorSnapshot.id).where(ranked.c.rank == 1)
        )
    }
    return [(c, latest.get(c.id)) for c in customers], total


def score(pairs):
    """Rows of kind scored / recorded / no_snapshot, ordered like the /churn page."""
    rows = []
    for customer, snapshot in pairs:
        if snapshot is None:
            rows.append({"kind": "no_snapshot", "customer": customer})
        elif snapshot.churned:
            rows.append({"kind": "recorded", "customer": customer, "snapshot": snapshot})
        else:
            values = {feature: getattr(snapshot, feature.lower()) for feature in MAIN_FEATURES}
            result = churn_model.predict(values, explain=True)
            rows.append({"kind": "scored", "customer": customer, "snapshot": snapshot, "prediction": result})
    order = {"scored": 0, "recorded": 1, "no_snapshot": 2}
    rows.sort(key=lambda r: (
        order[r["kind"]],
        -r["prediction"]["churn_probability"] if r["kind"] == "scored" else 0,
        r["customer"].external_id,
    ))
    return rows


def drivers(prediction):
    factors = [f for f in prediction["explanation"]["factors"] if f["shap_value"] > 0][:TOP_FACTORS]
    return "; ".join(LABELS[f["feature"]] for f in factors) or "Không có yếu tố làm tăng nguy cơ"


def watchlist_report(payload, ctx, db):
    require(ctx, ["customers.read", "inference.json.run"])
    churn_model.require()
    db.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"))
    db.execute(text("SET LOCAL statement_timeout = '5000ms'"))
    try:
        pairs, total = latest_snapshots(db)
        # Copy plain values inside the read-only transaction; nothing is lazily reloaded afterwards.
        rows = [
            {
                "kind": r["kind"],
                "code": customer_code(r["customer"].external_id),
                "captured_at": r["snapshot"].captured_at if "snapshot" in r else None,
                "prediction": r.get("prediction"),
            }
            for r in score(pairs)
        ]
        considered = len(pairs)
    finally:
        db.rollback()
    tally = {key: 0 for key in ("high", "medium", "low", "recorded", "no_snapshot")}
    for row in rows:
        tally[row["prediction"]["risk_level"] if row["kind"] == "scored" else row["kind"]] += 1
    selected = [r for r in rows if r["kind"] == "scored" and r["prediction"]["risk_level"] in payload.risk_levels]
    info = churn_model.info()
    thresholds = info["risk_thresholds"]
    out = report("Danh sách khách hàng cần giữ chân", "churn_watchlist")
    out["metadata"] = [
        ("Nguồn", "PostgreSQL - bản ghi hành vi mới nhất của khách hàng đang hoạt động"),
        ("Mô hình", f"XGBoost {info['model_version']} ({info['feature_count']} thuộc tính)"),
        ("Ngưỡng mức rủi ro", f"Thấp dưới {vn(thresholds['low_below'], 2)}; Cao từ {vn(thresholds['high_from'], 2)}"),
        ("Mức rủi ro được xuất", ", ".join(LEVELS[level] for level in ("high", "medium", "low") if level in payload.risk_levels)),
        ("Khách hàng được xét", f"{considered} / {total} khách hàng đang hoạt động"),
    ]
    out["sections"] = [
        section("Tổng hợp theo mức rủi ro", ["Nhóm", "Số khách hàng"], [
            ["Rủi ro cao", tally["high"]],
            ["Rủi ro trung bình", tally["medium"]],
            ["Rủi ro thấp", tally["low"]],
            ["Đã ghi nhận rời bỏ", tally["recorded"]],
            ["Chưa có bản ghi hành vi", tally["no_snapshot"]],
        ]),
        section(
            "Khách hàng cần giữ chân",
            ["Hạng", "Mã khách hàng", "Xác suất rời bỏ", "Mức rủi ro", "Yếu tố làm tăng nguy cơ", "Bản ghi hành vi (TP.HCM)"],
            [
                [
                    index,
                    r["code"],
                    f"{vn(100 * r['prediction']['churn_probability'], 1)}%",
                    LEVELS[r["prediction"]["risk_level"]],
                    drivers(r["prediction"]),
                    r["captured_at"],
                ]
                for index, r in enumerate(selected, start=1)
            ],
        ),
    ]
    recorded = [r for r in rows if r["kind"] == "recorded"]
    if recorded:
        out["sections"].append(section(
            "Đã ghi nhận rời bỏ",
            ["Mã khách hàng", "Bản ghi hành vi (TP.HCM)"],
            [[r["code"], r["captured_at"]] for r in recorded],
        ))
    out["notes"] = [
        ("Xác suất là dự báo trạng thái rời bỏ của bản ghi hành vi mới nhất, không phải thời điểm khách hàng rời đi. "
        "Yếu tố làm tăng nguy cơ là các thuộc tính có đóng góp SHAP dương lớn nhất; đây là liên hệ thống kê, không phải "
        "quan hệ nhân quả. Kết quả được tính lại khi xuất và không lưu vào cơ sở dữ liệu.")
    ]
    if total > considered:
        out["notes"].append(f"Chỉ xét {considered} khách hàng mới nhất trong tổng số {total} khách hàng đang hoạt động.")
    out["summary"] = (
        f"Có {tally['high']} khách hàng rủi ro cao và {tally['medium']} khách hàng rủi ro trung bình trong "
        f"{considered} khách hàng được xét."
    )
    return out
