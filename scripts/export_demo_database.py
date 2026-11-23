"""Xuất bản sao database để nộp hoặc bàn giao, với mật khẩu demo thay cho mật khẩu thật.

    python -m scripts.export_demo_database                 # -> dist/MK-eAI-demo-database.sql
    python -m scripts.export_demo_database --pg-bin "C:\\Program Files\\PostgreSQL\\17\\bin"

Database đang chạy KHÔNG bị thay đổi: script chỉ đọc qua pg_dump rồi sửa trên tệp xuất ra.
- Mọi tài khoản được đặt lại mật khẩu demo theo vai trò (in ra cuối script), bỏ khóa tạm và lần đăng nhập cuối.
- Không xuất dữ liệu phiên đăng nhập (auth_sessions) và nhật ký hoạt động (auth_audit_events).
- Tệp xuất ở dạng SQL thuần, không gắn chủ sở hữu (--no-owner) để khôi phục được bằng bất kỳ tài khoản PostgreSQL nào.
Mật khẩu kết nối lấy từ DATABASE_URL trong .env và chỉ truyền qua biến môi trường PGPASSWORD, không in ra.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

from sqlalchemy.engine import make_url

from backend.core.passwords import hash_password, normalize_password

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dist" / "MK-eAI-demo-database.sql"
DEMO_PASSWORDS = {
    "ADMIN": "Admin@2026",
    "OPERATOR": "Operator@2026",
    "VIEWER": "Viewer@2026",
}
SKIP_DATA = ("public.auth_sessions", "public.auth_audit_events")


def database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        env = (ROOT / ".env").read_text(encoding="utf-8")
        match = re.search(r"^DATABASE_URL=(.*)$", env, re.MULTILINE)
        if not match:
            raise SystemExit("Không tìm thấy DATABASE_URL trong môi trường hoặc .env")
        url = match.group(1).strip()
    return url


def find_pg_dump(pg_bin: str | None) -> str:
    if pg_bin:
        candidate = Path(pg_bin) / ("pg_dump.exe" if os.name == "nt" else "pg_dump")
        if candidate.exists():
            return str(candidate)
        raise SystemExit(f"Không thấy pg_dump trong {pg_bin}")
    found = shutil.which("pg_dump")
    if not found:
        raise SystemExit(
            "Không thấy pg_dump. Thêm thư mục bin của PostgreSQL vào PATH hoặc dùng --pg-bin"
        )
    return found


def dump(pg_dump: str) -> str:
    url = make_url(database_url())
    env = dict(os.environ, PGPASSWORD=url.password or "", PGCLIENTENCODING="UTF8")
    args = [
        pg_dump,
        "--format=plain",
        "--no-owner",
        "--no-privileges",
        "--encoding=UTF8",
        "-h",
        url.host or "localhost",
        "-p",
        str(url.port or 5432),
        "-U",
        url.username,
        "-d",
        url.database,
    ]
    for table in SKIP_DATA:
        args.append(f"--exclude-table-data={table}")
    result = subprocess.run(args, check=False, env=env, capture_output=True)
    if result.returncode != 0:
        raise SystemExit(
            "pg_dump lỗi: " + result.stderr.decode("utf-8", "replace")[-500:]
        )
    return result.stdout.decode("utf-8").replace(
        "\r\n", "\n"
    )  # pg_dump trên Windows xuống dòng kiểu CRLF


def rewrite_users(sql: str) -> tuple[str, list[tuple[str, str]], list[str]]:
    lines = sql.split("\n")
    start = next(
        i for i, line in enumerate(lines) if line.startswith("COPY public.users ")
    )
    cols = [
        c.strip().strip('"')
        for c in re.search(r"\((.*)\)", lines[start]).group(1).split(",")
    ]
    idx = {name: cols.index(name) for name in cols}
    hashes = {
        role: hash_password(normalize_password(pw))
        for role, pw in DEMO_PASSWORDS.items()
    }
    accounts, old_hashes = [], []
    i = start + 1
    while lines[i] != "\\.":
        values = lines[i].split("\t")
        role = values[idx["role"]]
        old_hashes.append(values[idx["password_hash"]])
        values[idx["password_hash"]] = hashes[role]
        values[idx["must_change_password"]] = "f"
        values[idx["failed_attempts"]] = "0"
        for name in ("failure_window_started_at", "locked_until", "last_login_at"):
            values[idx[name]] = "\\N"
        lines[i] = "\t".join(values)
        accounts.append((values[idx["username"]], role))
        i += 1
    return "\n".join(lines), accounts, old_hashes


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--pg-bin", help="thư mục chứa pg_dump nếu không có trong PATH")
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    sql, accounts, old_hashes = rewrite_users(dump(find_pg_dump(args.pg_bin)))
    leaked = [h for h in old_hashes if h and h in sql]
    if leaked:
        raise SystemExit("Dừng: mật khẩu băm gốc vẫn còn trong tệp xuất")
    for table in SKIP_DATA:
        if re.search(rf"^COPY {re.escape(table)} ", sql, re.MULTILINE):
            raise SystemExit(f"Dừng: dữ liệu {table} không được phép xuất")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(sql, encoding="utf-8", newline="\n")

    print(f"Đã ghi {args.out} ({args.out.stat().st_size / 1024:.0f} KB)")
    print("Tài khoản demo (mật khẩu theo vai trò):")
    for username, role in sorted(
        accounts, key=lambda a: ("ADMIN", "OPERATOR", "VIEWER").index(a[1])
    ):
        print(f"  {username:<12} {role:<9} {DEMO_PASSWORDS[role]}")


if __name__ == "__main__":
    main()
