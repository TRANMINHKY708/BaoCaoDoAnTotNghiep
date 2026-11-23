"""K12: kiểm tra máy trước buổi demo hoặc bảo vệ. Chỉ đọc, không ghi dữ liệu và không in bí mật.

    .\\.venv\\Scripts\\python.exe -m scripts.preflight_demo            # kiểm tra môi trường, CSDL, mô hình
    .\\.venv\\Scripts\\python.exe -m scripts.preflight_demo --live     # bắt buộc backend và frontend đang chạy
    .\\.venv\\Scripts\\python.exe -m scripts.preflight_demo --gemini   # gửi thêm một câu hỏi rất ngắn tới Gemini

Mã thoát 0 khi không có mục LỖI; các mục CẢNH BÁO không chặn buổi demo nhưng nên xử lý.
"""

import argparse
import importlib
import json
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OK, WARN, FAIL = "OK", "CẢNH BÁO", "LỖI"
TABLES = [
    "users", "auth_sessions", "auth_audit_events",
    "customers", "customer_behavior_snapshots", "customer_source_identities",
    "ml_models", "prediction_runs", "prediction_results", "segmentation_results",
    "prediction_scenarios", "scenario_results",
    "bulk_import_jobs", "bulk_import_rows", "bulk_analysis_jobs", "bulk_analysis_items",
]
RESEARCH_EXPORTS = [
    "frontend/src/features/insights/researchInsights.json",
    "frontend/src/features/churn/data/churnReport.json",
    "frontend/src/features/explorer/data/clusterReport.json",
    "frontend/src/features/explorer/data/edaData.json",
    "frontend/src/features/explorer/data/modelLab.json",
]
PACKAGES = [
    ("fastapi", True), ("sqlalchemy", True), ("psycopg", True), ("sklearn", True), ("xgboost", True),
    ("argon2", True), ("reportlab", True), ("openpyxl", True), ("google.genai", False),
]


class Report:
    def __init__(self):
        self.rows = []

    def add(self, group, status, message):
        self.rows.append((group, status, message))

    def run(self, group, check):
        """Một lỗi bất ngờ trong một nhóm không làm dừng các nhóm còn lại; không in chi tiết ngoại lệ."""
        try:
            check(self)
        except Exception as exc:  # noqa: BLE001
            self.add(group, FAIL, f"Không kiểm tra được ({type(exc).__name__}).")

    @property
    def failed(self):
        return sum(1 for _, status, _ in self.rows if status == FAIL)

    def print(self):
        width = max(len(group) for group, _, _ in self.rows)
        for group, status, message in self.rows:
            print(f"[{status:^9}] {group:<{width}}  {message}")
        warned = sum(1 for _, status, _ in self.rows if status == WARN)
        print(f"\nKết quả: {len(self.rows) - self.failed - warned} đạt, {warned} cảnh báo, {self.failed} lỗi.")


def check_python(r):
    version = platform.python_version()
    r.add("Python", OK if sys.version_info[:2] == (3, 11) else WARN,
          f"Python {version}" + ("" if sys.version_info[:2] == (3, 11) else " (dự án được kiểm thử trên 3.11)"))
    in_venv = Path(sys.prefix).resolve() == (ROOT / ".venv").resolve()
    r.add("Python", OK if in_venv else WARN,
          "Đang dùng môi trường .venv của dự án" if in_venv else "Không chạy bằng .venv của dự án")
    for name, required in PACKAGES:
        try:
            importlib.import_module(name)
            r.add("Thư viện", OK, f"{name} đã cài")
        except ImportError:
            r.add("Thư viện", FAIL if required else WARN,
                  f"Thiếu {name}" + ("" if required else " (chỉ cần cho trợ lý AI)"))


def check_config(r):
    from backend.core.config import GeminiSettings, Settings

    env = ROOT / ".env"
    r.add("Cấu hình", OK if env.is_file() else FAIL, "Có tệp .env" if env.is_file() else "Thiếu tệp .env ở thư mục gốc")
    settings = Settings()
    r.add("Cấu hình", OK if settings.database_url else FAIL,
          "Đã cấu hình DATABASE_URL" if settings.database_url else "Chưa cấu hình DATABASE_URL")
    gemini = GeminiSettings()
    key = gemini.gemini_api_key.get_secret_value().strip() if gemini.gemini_api_key else ""
    r.add("Cấu hình", OK if key else WARN,
          "Đã cấu hình khóa Gemini" if key else "Chưa có GEMINI_API_KEY: trợ lý AI sẽ báo chưa sẵn sàng")
    valid_model = re.fullmatch(r"gemini-[a-zA-Z0-9.-]{1,80}", gemini.gemini_model.strip()) is not None
    r.add("Cấu hình", OK if valid_model else FAIL, f"Mô hình Gemini: {gemini.gemini_model}" if valid_model
          else "Tên mô hình Gemini không hợp lệ")


def check_models(r):
    from backend.services.churn_model import ChurnModel
    from backend.services.versioned_models import pins, verify_pin

    for pin in pins():
        label = f"{pin['task']} {pin['version']}"
        try:
            verify_pin(pin)
            r.add("Mô hình", OK, f"{label}: mã băm khớp")
        except (OSError, ValueError, KeyError):
            r.add("Mô hình", FAIL if pin["default"] else WARN, f"{label}: thiếu tệp hoặc mã băm không khớp")
    churn = ChurnModel().load()
    r.add("Mô hình", OK if churn.available else FAIL,
          "Mô hình rời bỏ: mã băm khớp, nạp được" if churn.available else "Mô hình rời bỏ không nạp được")
    for relative in RESEARCH_EXPORTS:
        path = ROOT / relative
        try:
            json.loads(path.read_text(encoding="utf-8"))
            r.add("Dữ liệu nghiên cứu", OK, f"{path.name} đọc được")
        except (OSError, ValueError):
            r.add("Dữ liệu nghiên cứu", FAIL, f"{path.name} thiếu hoặc hỏng")


def check_database(r):
    from sqlalchemy import inspect, text

    from backend.core.config import Settings
    from backend.db.session import get_engine

    engine = get_engine(Settings().database_url)
    with engine.connect() as connection:
        connection.execute(text("SET TRANSACTION READ ONLY"))
        version = connection.execute(text("SHOW server_version")).scalar_one()
        r.add("Cơ sở dữ liệu", OK, f"Kết nối được PostgreSQL {version.split(' ')[0]}")
        missing = sorted(set(TABLES) - set(inspect(connection).get_table_names()))
        r.add("Cơ sở dữ liệu", FAIL if missing else OK,
              f"Thiếu bảng: {', '.join(missing)} (chạy lại các lệnh migrate)" if missing else f"Đủ {len(TABLES)} bảng nghiệp vụ")
        if missing:
            return
        usable = dict(connection.execute(text(
            "SELECT role, count(*) FROM users WHERE is_active AND NOT must_change_password "
            "AND (locked_until IS NULL OR locked_until < now()) GROUP BY role"
        )).all())
        for role in ("ADMIN", "OPERATOR", "VIEWER"):
            count = usable.get(role, 0)
            r.add("Tài khoản", OK if count else (FAIL if role == "ADMIN" else WARN),
                  f"{role}: {count} tài khoản dùng được" if count else
                  f"{role}: chưa có tài khoản đăng nhập được (đang hoạt động, đã đổi mật khẩu, không bị khóa)")
        customers, with_snapshot = connection.execute(text(
            "SELECT count(*), count(*) FILTER (WHERE EXISTS (SELECT 1 FROM customer_behavior_snapshots s "
            "WHERE s.customer_id = c.id)) FROM customers c WHERE c.is_active"
        )).one()
        r.add("Dữ liệu demo", OK if with_snapshot else WARN,
              f"{customers} khách hàng đang hoạt động, {with_snapshot} khách có bản ghi hành vi" if with_snapshot else
              "Chưa có khách hàng có bản ghi hành vi: các trang phân tích và giữ chân sẽ trống")
        connection.rollback()


def check_reports(r):
    from backend.services.report_renderers import register_font

    try:
        register_font()
        r.add("Xuất báo cáo", OK, "Có font Unicode cho PDF tiếng Việt")
    except Exception:  # noqa: BLE001
        r.add("Xuất báo cáo", FAIL, "Không có font Unicode cho PDF (Arial hoặc DejaVu Sans)")


def check_frontend(r):
    node = shutil.which("node")
    if not node:
        r.add("Frontend", FAIL, "Không tìm thấy Node.js trong PATH")
    else:
        version = subprocess.run([node, "--version"], check=False, capture_output=True, text=True, timeout=10).stdout.strip()
        major = int(re.match(r"v(\d+)", version).group(1)) if re.match(r"v(\d+)", version) else 0
        r.add("Frontend", OK if major >= 20 else WARN, f"Node.js {version}" + ("" if major >= 20 else " (nên dùng 20 trở lên)"))
    modules = ROOT / "frontend/node_modules"
    r.add("Frontend", OK if modules.is_dir() else FAIL,
          "Đã cài thư viện frontend" if modules.is_dir() else "Chưa cài thư viện frontend (cd frontend; npm ci)")


def check_servers(r, live):
    import httpx

    missing = FAIL if live else WARN
    for name, url, expect in (
        ("Backend", "http://127.0.0.1:8000/api/v1/health", "application/json"),
        ("Frontend", "http://127.0.0.1:5173/", "text/html"),
    ):
        try:
            response = httpx.get(url, timeout=5, follow_redirects=False)
            fine = response.status_code == 200 and expect in response.headers.get("content-type", "")
            r.add("Máy chủ", OK if fine else FAIL, f"{name} trả lời tại {url}" if fine
                  else f"{name} tại {url} trả mã {response.status_code}")
        except httpx.HTTPError:
            r.add("Máy chủ", missing, f"{name} chưa chạy tại {url}")
    try:
        response = httpx.get("http://127.0.0.1:8000/api/v1/health", timeout=5)
        profile = response.headers.get("X-Security-Profile")
        if profile:
            r.add("Máy chủ", OK if profile == "accounts" else WARN,
                  "Backend đang ở chế độ tài khoản" if profile == "accounts" else
                  f"Backend đang ở chế độ {profile}; demo cần chế độ tài khoản (. .\\scripts\\accounts_local.ps1)")
    except httpx.HTTPError:
        pass


def check_download_managers(r):
    if platform.system() != "Windows":
        return
    listing = subprocess.run(["tasklist", "/FO", "CSV", "/NH"], check=False, capture_output=True, text=True, timeout=20).stdout
    running = {line.split(",")[0].strip('"').lower() for line in listing.splitlines() if line}
    if running & {"idman.exe", "iemonitor.exe"}:
        r.add("Trình tải", WARN,
              "Internet Download Manager đang chạy và có thể chặn nút Xuất PDF: tắt IDM hoặc thêm 127.0.0.1 "
              "vào danh sách loại trừ (IDM > Options > File types > Edit list)")
    else:
        r.add("Trình tải", OK, "Không thấy Internet Download Manager đang chạy")


def check_gemini(r):
    from backend.core.config import GeminiSettings

    settings = GeminiSettings()
    key = settings.gemini_api_key.get_secret_value().strip() if settings.gemini_api_key else ""
    if not key:
        r.add("Gemini", FAIL, "Không thử được vì chưa có khóa")
        return
    from google import genai

    client = genai.Client(api_key=key)
    try:
        reply = client.models.generate_content(model=settings.gemini_model.strip(), contents="Trả lời đúng một từ: OK")
        r.add("Gemini", OK if (reply.text or "").strip() else FAIL, "Gemini trả lời được câu hỏi thử")
    except Exception:  # noqa: BLE001 -- provider errors may contain request details
        r.add("Gemini", FAIL, "Gemini từ chối hoặc không trả lời (kiểm tra khóa, hạn mức, mạng)")
    finally:
        client.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description="Kiểm tra máy trước buổi demo MK eAI (chỉ đọc).")
    parser.add_argument("--live", action="store_true", help="bắt buộc backend và frontend đang chạy")
    parser.add_argument("--gemini", action="store_true", help="gửi một câu hỏi rất ngắn tới Gemini (tốn hạn mức)")
    args = parser.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    sys.path.insert(0, str(ROOT))
    r = Report()
    r.run("Python", check_python)
    r.run("Cấu hình", check_config)
    r.run("Mô hình", check_models)
    r.run("Cơ sở dữ liệu", check_database)
    r.run("Xuất báo cáo", check_reports)
    r.run("Frontend", check_frontend)
    r.run("Máy chủ", lambda report: check_servers(report, args.live))
    r.run("Trình tải", check_download_managers)
    if args.gemini:
        r.run("Gemini", check_gemini)
    r.print()
    return 1 if r.failed else 0


if __name__ == "__main__":
    sys.exit(main())
