"""K13 audit-log workbook: the filtered events as one formula-free XLSX (shared report renderer)."""

from backend.services import report_renderers
from backend.services.admin_audit import EXPORT_LIMIT
from backend.services.report_data import report, section

EVENTS = {
    "auth.login": "Đăng nhập",
    "auth.logout": "Đăng xuất",
    "auth.password_changed": "Đổi mật khẩu",
    "auth.password_reset": "Đặt lại mật khẩu",
    "auth.sessions_revoked": "Thu hồi phiên đăng nhập",
    "auth.bootstrap": "Khởi tạo quản trị viên đầu tiên",
    "user.created": "Tạo tài khoản",
    "user.updated": "Cập nhật tài khoản",
    "user.locked": "Khóa tài khoản",
    "user.unlocked": "Mở khóa tài khoản",
    "user.role_changed": "Đổi vai trò",
    "business.created": "Tạo dữ liệu nghiệp vụ",
    "business.updated": "Cập nhật dữ liệu nghiệp vụ",
    "business.replayed": "Gửi lại yêu cầu đã xử lý",
}
CATEGORIES = {"auth": "Đăng nhập và phiên", "users": "Quản lý người dùng", "business": "Dữ liệu nghiệp vụ"}
OUTCOMES = {"success": "Thành công", "denied": "Bị từ chối", "failure": "Lỗi"}
RESOURCES = {"users": "Tài khoản", "customer": "Khách hàng", "snapshot": "Bản ghi hành vi",
             "prediction_run": "Lượt dự đoán", "scenario": "Kịch bản What-if"}
ROLES = {"ADMIN": "Quản trị viên", "OPERATOR": "Vận hành", "VIEWER": "Chỉ xem"}


def name(person):
    if person is None:
        return "—"
    label = person["username"] if person["display_name"] == person["username"] else (
        f"{person['display_name']} ({person['username']})")
    return f"{label} · {ROLES[person['role']]}"


def workbook(events, query, truncated, who):
    out = report("Nhật ký hoạt động", "audit_log")
    filters = [
        ("Người dùng", name(who) if who else ("Không tìm thấy" if query["user_id"] else "Tất cả")),
        ("Nhóm sự kiện", CATEGORIES.get(query["category"], "Tất cả")),
        ("Kết quả", OUTCOMES.get(query["outcome"], "Tất cả")),
        ("Từ ngày", query["date_from"].strftime("%d/%m/%Y") if query["date_from"] else "Không giới hạn"),
        ("Đến ngày", query["date_to"].strftime("%d/%m/%Y") if query["date_to"] else "Không giới hạn"),
        ("Múi giờ của bộ lọc ngày", "TP.HCM (UTC+7)" if query["timezone"] == "Asia/Ho_Chi_Minh" else "UTC"),
    ]
    out["metadata"] = [("Nguồn", "Bảng nhật ký hoạt động (chỉ đọc)"), *filters,
                       ("Số sự kiện đã xuất", f"{len(events)}" + (f" (giới hạn {EXPORT_LIMIT:,})".replace(",", ".")
                                                                  if truncated else ""))]
    out["sections"] = [section(
        "Sự kiện",
        ["Thời gian (TP.HCM)", "Hành động", "Nhóm", "Kết quả", "Người thực hiện", "Đối tượng", "Tài nguyên",
         "Mã yêu cầu"],
        [
            [
                e["occurred_at"],
                EVENTS.get(e["event_code"], e["event_code"]),
                CATEGORIES[e["category"]],
                OUTCOMES[e["outcome"]],
                name(e["actor"]),
                name(e["subject"]),
                f"{RESOURCES.get(e['resource_type'], e['resource_type'])} {e['resource_id']}" if e["resource_type"] else "—",
                e["request_id"],
            ]
            for e in events
        ],
    )]
    out["notes"] = [
        ("Mới nhất trước. Tệp không chứa mã phiên, token, mật khẩu hay nội dung chi tiết của sự kiện. "
        "Người thực hiện để trống khi sự kiện không gắn với một tài khoản đã đăng nhập (ví dụ sai mật khẩu).")
    ]
    if truncated:
        out["notes"].append(
            f"Có hơn {EXPORT_LIMIT:,} sự kiện khớp bộ lọc; tệp chỉ gồm {EXPORT_LIMIT:,} sự kiện mới nhất. "
            "Hãy thu hẹp khoảng ngày để xuất phần còn lại.".replace(",", ".")
        )
    out["summary"] = f"{len(events)} sự kiện theo bộ lọc nêu trên."
    out["sheet_caption"] = "Ngày giờ TP.HCM (UTC+7). Nhật ký chỉ đọc, sự kiện mới nhất ở trên."
    return report_renderers.xlsx(out)
