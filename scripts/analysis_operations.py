"""Separate F10 check/interactive migration; never invoked by web startup."""

import argparse
import sys

from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import SQLAlchemyError

from alembic import command
from backend.core.config import get_settings
from backend.db.auth_application_guard import verify_application
from backend.db.bulk_guard import F10_UPGRADE
from backend.models.analysis import F10_REVISION, F10_TABLES
from backend.models.bulk import F09_REVISION, F09_TABLES
from scripts.accounts_operations import BUSINESS, revision, safe_database_failure


def migrate(connection):
    verify_application(connection)
    connection.exec_driver_sql("SELECT pg_advisory_xact_lock(1096111176, 9)")
    if revision(connection) != F09_REVISION:
        raise RuntimeError("Expected F09 revision f09b20261105; stop and inspect")
    expected = (
        BUSINESS
        | F09_TABLES
        | {
            "users",
            "auth_sessions",
            "auth_audit_events",
            "alembic_version",
        }
    )
    if set(inspect(connection).get_table_names()) != expected:
        raise RuntimeError("Unexpected existing schema; no F10 upgrade performed")
    connection.info["f10_application_upgrade"] = F10_UPGRADE
    try:
        config = Config("alembic.ini")
        config.attributes["connection"] = connection
        command.upgrade(config, F10_REVISION)
        if not F10_TABLES.issubset(inspect(connection).get_table_names()):
            raise RuntimeError("F10 verification failed")
    finally:
        connection.info.pop("f10_application_upgrade", None)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["check", "migrate"])
    args = parser.parse_args()
    engine = None
    try:
        engine = create_engine(get_settings().database_url, echo=False)
        with engine.connect() as connection:
            verify_application(connection)
            print("Database: ecommerce_ai; revision:", revision(connection))
        if args.operation == "check":
            return
        if (
            not sys.stdin.isatty()
            or input(
                "After verified backup/isolated restore, type MIGRATE F10 ecommerce_ai: "
            )
            != "MIGRATE F10 ecommerce_ai"
        ):
            raise RuntimeError("Interactive confirmation required")
        with engine.begin() as connection:
            migrate(connection)
        print("F10 migration completed:", F10_REVISION)
    except SQLAlchemyError as exc:
        raise SystemExit(safe_database_failure(exc)) from None
    except Exception:  # noqa: BLE001 -- never echo configuration/driver details
        raise SystemExit(
            "F10 operation refused/failed. Stop; no success claimed. No credentials printed."
        ) from None
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    main()
