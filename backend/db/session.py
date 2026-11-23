"""Lazy SQLAlchemy engine and request-scoped sessions."""

from collections.abc import Generator
from fastapi import Request

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from backend.core.config import get_settings


_engine: Engine | None = None
_engine_url: str | None = None
_session_factory: sessionmaker[Session] | None = None


def get_database_url(*, testing: bool = False) -> str | None:
    settings = get_settings()
    if testing:
        return settings.test_database_url
    return settings.database_url


def get_engine(database_url: str | None = None) -> Engine:
    global _engine, _engine_url, _session_factory

    url = database_url or get_database_url()
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not configured. Copy .env.example to .env "
            "and provide the application database credentials."
        )

    if _engine is None or _engine_url != url:
        if _engine is not None:
            _engine.dispose()
        _engine = create_engine(
            url,
            pool_pre_ping=True,
            echo=get_settings().database_echo,
        )
        _engine_url = url
        _session_factory = sessionmaker(
            bind=_engine,
            class_=Session,
            autoflush=False,
            expire_on_commit=False,
        )

    return _engine


def get_session_factory(
    database_url: str | None = None,
) -> sessionmaker[Session]:
    get_engine(database_url)
    assert _session_factory is not None
    return _session_factory


def get_db(request: Request) -> Generator[Session, None, None]:
    accounts = request.app.state.settings.security_profile == "accounts"
    factory = request.app.state.accounts.sessions if accounts else get_session_factory()
    db = factory()
    try:
        if accounts and getattr(request.state, "auth_writer", False):
            from backend.services.account_business import bind_writer
            bind_writer(db, request)
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_optional_db(request: Request) -> Generator[Session | None, None, None]:
    """Keep legacy inference APIs usable when persistence is disabled."""
    if request.app.state.settings.security_profile != "accounts" and not get_database_url():
        yield None
        return

    yield from get_db(request)


def check_database_connection(
    database_url: str | None = None,
) -> bool:
    with get_engine(database_url).connect() as connection:
        return connection.execute(text("SELECT 1")).scalar_one() == 1


def reset_database_state() -> None:
    """Dispose cached connections; primarily used by isolated tests."""
    global _engine, _engine_url, _session_factory
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _engine_url = None
    _session_factory = None
