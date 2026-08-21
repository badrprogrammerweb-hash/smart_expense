"""The database URL must select the async driver this project actually ships.

`app/db.py` builds its engine with `create_async_engine`, and
`apps/api/requirements.txt` pins exactly one PostgreSQL driver: `asyncpg`. A URL
that names no driver (`postgresql://…`) makes SQLAlchemy fall back to its default
DBAPI, psycopg2, which is neither installed nor asyncio-capable.

That combination took staging down while `/health` kept reporting `ok`: the
engine is built lazily on first use, so the process starts and stays live, and
only the routes that touch the database fail — with
`ModuleNotFoundError: No module named 'psycopg2'` raised from
`sqlalchemy/dialects/postgresql/psycopg2.py`.

The URLs below are deliberately unroutable dummies. Nothing here connects to a
database, so no credential is required and none is used.
"""

import pytest
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import create_async_engine

import app.core.config as config_module
from app.core.config import ASYNC_POSTGRES_DRIVER


DUMMY_TAIL = "user:pw@db.example.invalid:5432/postgres"


def _settings_db_url(monkeypatch: pytest.MonkeyPatch, raw: str) -> str:
    """Read SUPABASE_DB_URL back through the real settings path."""

    with monkeypatch.context() as environment:
        environment.setenv("SUPABASE_DB_URL", raw)
        config_module.get_settings.cache_clear()
        try:
            return config_module.get_settings().supabase_db_url
        finally:
            config_module.get_settings.cache_clear()


@pytest.mark.parametrize(
    "raw",
    [
        # The form `apps/api/.env.example` documents and Supabase's dashboard
        # hands out -- this is what staging was configured with.
        f"postgresql://{DUMMY_TAIL}",
        # Older alias still emitted by several hosts.
        f"postgres://{DUMMY_TAIL}",
        # Surrounding whitespace must not defeat the normalization.
        f"  postgresql://{DUMMY_TAIL}  ",
    ],
)
def test_driverless_url_is_normalized_to_asyncpg(
    monkeypatch: pytest.MonkeyPatch, raw: str
) -> None:
    resolved = _settings_db_url(monkeypatch, raw)

    assert resolved.startswith(f"{ASYNC_POSTGRES_DRIVER}://")
    assert make_url(resolved).drivername == ASYNC_POSTGRES_DRIVER


def test_explicit_driver_is_left_alone(monkeypatch: pytest.MonkeyPatch) -> None:
    """An explicit driver stays the caller's choice."""

    already_async = f"postgresql+asyncpg://{DUMMY_TAIL}"
    assert _settings_db_url(monkeypatch, already_async) == already_async


def test_normalization_is_idempotent(monkeypatch: pytest.MonkeyPatch) -> None:
    once = _settings_db_url(monkeypatch, f"postgresql://{DUMMY_TAIL}")
    twice = _settings_db_url(monkeypatch, once)
    assert once == twice


def test_empty_url_stays_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    """`db.py` relies on an empty value to raise `database_not_configured`."""

    assert _settings_db_url(monkeypatch, "") == ""
    assert _settings_db_url(monkeypatch, "   ") == ""


def test_engine_builds_from_the_documented_url_shape(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The regression itself: this raised ModuleNotFoundError before the fix.

    `create_async_engine` resolves and imports the DBAPI eagerly, so this fails
    on a driverless URL without ever opening a connection.
    """

    resolved = _settings_db_url(monkeypatch, f"postgresql://{DUMMY_TAIL}")
    engine = create_async_engine(resolved, pool_pre_ping=True)
    try:
        assert engine.dialect.driver == "asyncpg"
        assert engine.dialect.is_async is True
    finally:
        engine.sync_engine.dispose()


def test_asyncpg_is_installed_and_psycopg2_is_not_required() -> None:
    """Guards the requirements pin the deployed image is built from."""

    import asyncpg  # noqa: F401  -- import is the assertion

    from sqlalchemy.dialects import registry

    assert registry.load("postgresql.asyncpg").is_async is True
    # psycopg2 is synchronous, so adding it could never satisfy
    # `create_async_engine`; it is not an alternative fix.
    assert registry.load("postgresql.psycopg2").is_async is False
