"""F09 explicit migration boundary; never used by server startup to perform DDL."""

from backend.db.auth_application_guard import verify_application
from backend.db.auth_test_guard import verify_auth_test_connection

F09_UPGRADE = object()
F10_UPGRADE = object()


def verify_runtime_revision(connection):
    from sqlalchemy import inspect

    from backend.models.analysis import F10_REVISION, F10_TABLES
    from backend.models.bulk import F09_REVISION, F09_TABLES

    revision = connection.exec_driver_sql(
        "SELECT version_num FROM alembic_version"
    ).scalar_one()
    if revision not in {"a02e4cf78001", F09_REVISION, F10_REVISION}:
        raise RuntimeError("Unverified application migration revision")
    if revision in {F09_REVISION, F10_REVISION} and not F09_TABLES.issubset(
        inspect(connection).get_table_names()
    ):
        raise RuntimeError("Incomplete F09 schema")
    if revision == F10_REVISION and not F10_TABLES.issubset(inspect(connection).get_table_names()):
        raise RuntimeError("Incomplete F10 schema")
    return revision


def require_analysis_upgrade(connection):
    if connection.info.get("f10_application_upgrade") is F10_UPGRADE:
        return verify_application(connection)
    if connection.info.get("f10_verified_test_upgrade") is F10_UPGRADE:
        return verify_auth_test_connection(connection)
    raise RuntimeError("Explicit verified F10 migration path required")


def require_bulk_upgrade(connection):
    if connection.info.get("f09_application_upgrade") is F09_UPGRADE:
        return verify_application(connection)
    if connection.info.get("f09_verified_test_upgrade") is F09_UPGRADE:
        return verify_auth_test_connection(connection)
    raise RuntimeError("Explicit verified F09 migration path required")
