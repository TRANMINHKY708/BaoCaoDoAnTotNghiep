"""Explicit application upgrade path; original test/downgrade guard unchanged."""

from sqlalchemy.engine import make_url

from backend.core.config import get_settings
from backend.db.auth_test_guard import require_auth_migration_test_guard

APPLICATION_UPGRADE = object()


def verify_application(connection):
    expected = make_url(get_settings().database_url or "")
    bound = connection.engine.url
    if (
        connection.dialect.name != "postgresql"
        or expected.database != "ecommerce_ai"
        or expected.host not in {"localhost", "127.0.0.1", "::1"}
        or (bound.host, bound.port, bound.database)
        != (expected.host, expected.port, expected.database)
        or connection.exec_driver_sql("SELECT current_database()").scalar_one()
        != "ecommerce_ai"
    ):
        raise RuntimeError("Application database identity refused")
    return "ecommerce_ai"


def require_auth_upgrade_guard(connection):
    if connection.info.get("application_auth_upgrade") is APPLICATION_UPGRADE:
        return verify_application(connection)
    return require_auth_migration_test_guard(connection)
