"""No implicit DDL. Only the existing approved, configured PostgreSQL test DB."""

from sqlalchemy import text
from sqlalchemy.engine import make_url

from backend.core.config import get_settings


def verify_auth_test_connection(connection):
    settings = get_settings()
    if not settings.test_database_url or not settings.database_url:
        raise RuntimeError(
            "Separate configured test and application databases required"
        )
    target, application = (
        make_url(settings.test_database_url),
        make_url(settings.database_url),
    )
    actual = connection.execute(text("SELECT current_database()")).scalar_one()
    if (
        connection.dialect.name != "postgresql"
        or actual != "ecommerce_ai_test"
        or target.database != actual
        or actual == application.database
    ):
        raise RuntimeError("Refusing AUTH migration: unapproved database identity")
    bound = connection.engine.url
    if (bound.host, bound.port, bound.database) != (
        target.host,
        target.port,
        target.database,
    ):
        raise RuntimeError(
            "Refusing AUTH migration: connection differs from configured test target"
        )
    return actual


def require_auth_migration_test_guard(connection):
    if not connection.info.get("auth02_verified_migration"):
        raise RuntimeError(
            "AUTH migration is test-only in AUTH-02; use the verified test connection"
        )
    return verify_auth_test_connection(connection)
