"""Localhost accounts launcher: one process, exclusive local lock, periodic cleanup."""

import logging
import threading
from contextlib import contextmanager
from pathlib import Path

from backend.core.config import get_settings
from backend.db.auth_application_guard import verify_application


@contextmanager
def single_instance(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a+b") as handle:
        handle.seek(0)
        if path.stat().st_size == 0:
            handle.write(b"0")
            handle.flush()
        handle.seek(0)
        try:
            if __import__("os").name == "nt":
                import msvcrt

                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise RuntimeError(
                "Accounts already running; use only one launcher"
            ) from None
        try:
            yield
        finally:
            handle.seek(0)
            if __import__("os").name == "nt":
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def cleanup_loop(service, stop):
    while not stop.is_set():
        try:
            service.cleanup()
        except Exception:  # noqa: BLE001 -- cleanup must not leak database details
            logging.getLogger(__name__).error(
                "Session cleanup failed; inspect database availability"
            )
        stop.wait(60)


def main():
    settings = get_settings()
    if (
        settings.security_profile != "accounts"
        or not settings.accounts_insecure_loopback
    ):
        raise RuntimeError("Explicit localhost accounts configuration required")
    import uvicorn

    from backend.main import create_app

    lock = Path(__file__).resolve().parents[1] / "reports/local/accounts/server.lock"
    with single_instance(lock):
        app = create_app(settings)
        service = app.state.accounts
        with service.engine.connect() as c:
            verify_application(c)
            from backend.db.bulk_guard import verify_runtime_revision

            verify_runtime_revision(c)
        stop = threading.Event()
        worker = threading.Thread(
            target=cleanup_loop, args=(service, stop), daemon=True
        )
        worker.start()
        try:
            uvicorn.run(app, host="127.0.0.1", port=8000, workers=1, access_log=False)
        finally:
            stop.set()
            worker.join(timeout=10)
            service.engine.dispose()


def startup_hint(exc):
    """A fixed Vietnamese hint chosen from the error kind; never echoes the error text (it may hold credentials)."""
    chain, seen = [], exc
    while seen is not None and len(chain) < 10:
        chain.append(seen)
        seen = seen.__cause__ or seen.__context__
    text = " ".join(str(e) for e in chain).lower()
    names = {type(e).__name__ for e in chain}
    if "password authentication failed" in text:
        return "Gợi ý: sai tài khoản hoặc mật khẩu PostgreSQL ở dòng DATABASE_URL trong tệp .env."
    if "does not exist" in text and "database" in text:
        return "Gợi ý: chưa có database ecommerce_ai; làm lại bước tạo cơ sở dữ liệu từ bản mẫu."
    if "OperationalError" in names:
        return "Gợi ý: không kết nối được PostgreSQL; kiểm tra PostgreSQL đang chạy và cổng 5432."
    if "database identity refused" in text:
        return "Gợi ý: tên database trong DATABASE_URL phải đúng là ecommerce_ai."
    if "explicit localhost accounts configuration" in text:
        return r"Gợi ý: chưa chạy '. .\scripts\accounts_local.ps1' trong cửa sổ này."
    if "already running" in text:
        return "Gợi ý: đang có một backend khác chạy; đóng cửa sổ đó rồi chạy lại."
    if "migration" in text or "schema" in text:
        return "Gợi ý: database chưa đúng phiên bản lược đồ; tạo lại từ tệp database/MK-eAI-demo-database.sql."
    if "FileNotFoundError" in names:
        return "Gợi ý: thiếu tệp của dự án; tải lại mã nguồn đầy đủ."
    return "Gợi ý: chạy 'python -m scripts.preflight_demo' để xem mục nào chưa sẵn sàng."


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 -- do not print credentials in startup failures
        raise SystemExit(
            "Accounts startup refused; check configuration, revision and existing launcher.\n"
            + startup_hint(exc)
        ) from None
