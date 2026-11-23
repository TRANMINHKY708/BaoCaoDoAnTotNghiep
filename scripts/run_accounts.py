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


if __name__ == "__main__":
    try:
        main()
    except Exception:  # noqa: BLE001 -- do not print credentials in startup failures
        raise SystemExit(
            "Accounts startup refused; check configuration, revision and existing launcher."
        ) from None
