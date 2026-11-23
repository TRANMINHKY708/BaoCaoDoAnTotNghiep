"""Separate interactive application commands. Never called by server startup."""

import argparse
import sys
import warnings
from getpass import GetPassWarning, getpass

from alembic.config import Config
from pydantic import ValidationError
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import SQLAlchemyError

from alembic import command
from backend.core.config import get_settings
from backend.db.auth_application_guard import APPLICATION_UPGRADE, verify_application

HEAD = "a02e4cf78001"
BUSINESS = {
    "customers",
    "customer_behavior_snapshots",
    "ml_models",
    "prediction_runs",
    "prediction_results",
    "segmentation_results",
    "prediction_scenarios",
    "scenario_results",
}


class SafeInputError(ValueError):
    """Only fixed messages/field names; never raw validation inputs."""


def validate_bootstrap_inputs(username, name, password, confirmation):
    from backend.schemas.admin import CreateUser

    if password != confirmation:
        raise SafeInputError(
            "Password confirmation differs. Enter both passwords again."
        )
    try:
        CreateUser(
            username=username,
            display_name=name,
            role="ADMIN",
            initial_password=password,
            admin_password=password,
        )
    except ValidationError as exc:
        fields = {
            e["loc"][0] for e in exc.errors(include_input=False, include_context=False)
        }
        hints = []
        if "username" in fields:
            hints.append(
                "Username: 3-64 lowercase letters/digits/._-, starting with letter/digit."
            )
        if "display_name" in fields:
            hints.append("Display name: 1-100 characters, not blank.")
        if fields & {"initial_password", "admin_password"}:
            hints.append(
                "Password: 8-128 characters after NFC normalization; not all whitespace or blocklisted."
            )
        raise SafeInputError("Input validation failed. " + " ".join(hints)) from None


def safe_database_failure(exc):
    # Never print SQL, parameters, driver messages, hashes or credentials.
    import re

    state = getattr(getattr(exc, "orig", None), "sqlstate", None)
    code = (
        state
        if isinstance(state, str) and re.fullmatch(r"[A-Z0-9]{5}", state)
        else "UNKNOWN"
    )
    return (
        "Database operation failed (SQLSTATE "
        + code
        + "). Stop; do not repeat blindly."
    )


def revision(c):
    return c.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one()


def migrate(c):
    verify_application(c)
    c.exec_driver_sql("SELECT pg_advisory_xact_lock(1096111176, 2)")
    if revision(c) != "df1cb0e019c4":
        raise RuntimeError("Expected business revision df1cb0e019c4; stop and inspect")
    if set(inspect(c).get_table_names()) != BUSINESS | {"alembic_version"}:
        raise RuntimeError("Unexpected schema; stop before upgrade")
    c.info["application_auth_upgrade"] = APPLICATION_UPGRADE
    try:
        cfg = Config("alembic.ini")
        cfg.attributes["connection"] = c
        command.upgrade(cfg, HEAD)
    finally:
        c.info.pop("application_auth_upgrade", None)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["check", "migrate", "bootstrap"])
    args = parser.parse_args()
    source = get_settings()
    engine = create_engine(source.database_url, echo=False)
    try:
        with engine.connect() as c:
            verify_application(c)
            print("Database: ecommerce_ai; revision:", revision(c))
        if args.operation == "check":
            return
        if not sys.stdin.isatty():
            raise RuntimeError("Interactive terminal required")
        phrase = (
            "MIGRATE ecommerce_ai"
            if args.operation == "migrate"
            else "BOOTSTRAP ecommerce_ai"
        )
        if (
            input("After verified backup/isolated restore, type " + phrase + ": ")
            != phrase
        ):
            raise RuntimeError("Confirmation refused")
        if args.operation == "migrate":
            with engine.begin() as c:
                migrate(c)
            print("Migration completed:", HEAD)
        else:
            from backend.services.accounts_service import AccountsService
            from scripts.bootstrap_auth_admin import bootstrap

            warnings.simplefilter("error", GetPassWarning)
            username = input("ADMIN username: ")
            name = input("Display name: ")
            password = getpass("Initial password (8-128 characters): ")
            validate_bootstrap_inputs(
                username, name, password, getpass("Repeat password: ")
            )
            service = AccountsService(
                source.model_copy(update={"security_profile": "accounts"})
            )
            try:
                identifier = bootstrap(
                    service, username, name, password, guard=verify_application
                )
                print("Admin created; first password change required:", identifier)
            finally:
                service.engine.dispose()
    except SafeInputError as exc:
        raise SystemExit(str(exc)) from None
    except SQLAlchemyError as exc:
        raise SystemExit(safe_database_failure(exc)) from None
    except Exception as exc:  # noqa: BLE001 -- print type only, never error inputs
        kind = type(exc).__name__
        raise SystemExit(
            "Operation refused/failed ("
            + kind
            + "). Stop; no success claimed. No credential details printed."
        ) from None
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
