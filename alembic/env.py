"""Alembic environment configured from EcommerceAI settings."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from backend.core.config import get_settings
from backend.db.base import Base
from backend.models.auth import AuthBase
import backend.models  # noqa: F401


config = context.config
if config.config_file_name is not None and config.attributes.get("connection") is None:
    fileConfig(config.config_file_name)

database_url = get_settings().database_url
if not database_url:
    raise RuntimeError(
        "DATABASE_URL is required to run Alembic migrations."
    )

config.set_main_option(
    "sqlalchemy.url",
    database_url.replace("%", "%%"),
)
target_metadata = [Base.metadata, AuthBase.metadata]


def run_migrations_offline() -> None:
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    external = config.attributes.get("connection")
    if external is not None:
        context.configure(connection=external, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
        return
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
