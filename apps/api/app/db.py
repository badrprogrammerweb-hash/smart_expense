import json
import logging
from collections.abc import AsyncIterator

from fastapi import Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.auth import CurrentUser, _is_test_or_dev_mode, _sanitized_db_error, get_current_user
from app.core.config import get_settings


_engine = None
_session_factory: async_sessionmaker[AsyncSession] | None = None
logger = logging.getLogger(__name__)


def get_engine():
    global _engine
    settings = get_settings()
    if not settings.supabase_db_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "database_not_configured", "message": "Database is not configured."},
        )
    if _engine is None:
        _engine = create_async_engine(settings.supabase_db_url, pool_pre_ping=True)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


def database_unavailable_exception(exc: DBAPIError | None = None) -> HTTPException:
    detail = {"code": "database_unavailable", "message": "Database is temporarily unavailable."}
    if exc is not None and _is_test_or_dev_mode():
        detail["diagnostic"] = _sanitized_db_error(exc)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=detail,
    )


async def get_rls_session(
    current_user: CurrentUser = Depends(get_current_user),
) -> AsyncIterator[AsyncSession]:
    session_factory = get_session_factory()
    async with session_factory() as session:
        async with session.begin():
            try:
                await session.execute(text("set local lock_timeout = '10s'"))
                await session.execute(text("set local statement_timeout = '10s'"))
                await session.execute(text("set local role authenticated"))
                await session.execute(
                    text("select set_config('request.jwt.claims', :claims, true)"),
                    {"claims": json.dumps(current_user.claims)},
                )
                await session.execute(
                    text("select set_config('request.jwt.claim.sub', :user_id, true)"),
                    {"user_id": str(current_user.user_id)},
                )
            except DBAPIError as exc:
                if _is_test_or_dev_mode():
                    logger.warning("RLS session setup failed: %s", _sanitized_db_error(exc))
                raise database_unavailable_exception(exc) from exc
            yield session
