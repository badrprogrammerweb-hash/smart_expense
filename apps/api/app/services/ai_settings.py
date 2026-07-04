"""Workspace BYOK AI settings service.

The raw provider key is only accepted long enough to validate its shape and pass
it as a bound parameter to the Vault-backed SECURITY DEFINER RPC.
"""

from __future__ import annotations

import re
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import database_unavailable_exception
from app.schemas.ai_settings import AiProvider, AiSettingsStatus


OPENAI_MIN_LENGTH = 20
GEMINI_MIN_LENGTH = 35
GEMINI_MAX_LENGTH = 45
MAX_KEY_LENGTH = 400
MASK_PREFIX = "\u2022" * 4
KEY_SHAPE_RE = re.compile(r"^[A-Za-z0-9_-]+$")


def not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "not_found", "message": "Workspace not found."},
    )


def forbidden() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "forbidden", "message": "You do not have permission to do that."},
    )


def invalid_key_format(provider: AiProvider | str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail={
            "code": "invalid_key_format",
            "message": f"Invalid key format for {provider}.",
        },
    )


def _masked_hint(key_last4: str | None) -> str | None:
    if not key_last4:
        return None
    return f"{MASK_PREFIX}{key_last4[-4:]}"


def _status_from_row(row) -> AiSettingsStatus:
    if row is None:
        return AiSettingsStatus(configured=False)
    return AiSettingsStatus(
        configured=True,
        provider=row.provider,
        masked_hint=_masked_hint(row.key_last4),
        updated_at=row.updated_at,
        updated_by=row.updated_by,
        updated_by_name=getattr(row, "updated_by_name", None),
    )


async def workspace_role(session: AsyncSession, workspace_id: UUID, user_id: UUID) -> str:
    result = await session.execute(
        text(
            """
            select wm.role
            from public.workspaces w
            join public.workspace_memberships wm
              on wm.workspace_id = w.id
             and wm.user_id = :user_id
            where w.id = :workspace_id
            """
        ),
        {"workspace_id": str(workspace_id), "user_id": str(user_id)},
    )
    row = result.first()
    if row is None:
        raise not_found()
    return row.role


async def require_owner(session: AsyncSession, workspace_id: UUID, user_id: UUID) -> None:
    role = await workspace_role(session, workspace_id, user_id)
    if role != "owner":
        raise forbidden()


def validate_key_shape(provider: AiProvider, api_key: str) -> str:
    if api_key != api_key.strip():
        raise invalid_key_format(provider)
    if not api_key or len(api_key) > MAX_KEY_LENGTH or not KEY_SHAPE_RE.fullmatch(api_key):
        raise invalid_key_format(provider)
    if provider is AiProvider.OPENAI and (
        not api_key.startswith("sk-") or len(api_key) < OPENAI_MIN_LENGTH
    ):
        raise invalid_key_format(provider)
    if provider is AiProvider.GEMINI and (
        not api_key.startswith("AIza")
        or len(api_key) < GEMINI_MIN_LENGTH
        or len(api_key) > GEMINI_MAX_LENGTH
    ):
        raise invalid_key_format(provider)
    return api_key


def _sqlstate(exc: DBAPIError) -> str | None:
    source = getattr(exc, "orig", None)
    for attr in ("sqlstate", "pgcode"):
        value = getattr(source, attr, None)
        if value:
            return str(value)
    return None


def _rpc_exception(exc: DBAPIError) -> HTTPException:
    code = _sqlstate(exc)
    if code == "42501":
        return forbidden()
    if code == "22023":
        return invalid_key_format("provider")
    return database_unavailable_exception()


async def get_ai_settings_status(
    session: AsyncSession, workspace_id: UUID, user_id: UUID
) -> AiSettingsStatus:
    await workspace_role(session, workspace_id, user_id)
    try:
        result = await session.execute(
            text(
                """
                select
                    s.provider,
                    s.key_last4,
                    s.updated_at,
                    s.updated_by,
                    coalesce(nullif(up.display_name, ''), up.email) as updated_by_name
                from public.workspace_ai_settings s
                left join public.user_profiles up on up.id = s.updated_by
                where s.workspace_id = :workspace_id
                """
            ),
            {"workspace_id": str(workspace_id)},
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc
    return _status_from_row(result.first())


async def _assert_single_config(session: AsyncSession, workspace_id: UUID) -> None:
    result = await session.execute(
        text(
            """
            select count(*)::int
            from public.workspace_ai_settings
            where workspace_id = :workspace_id
            """
        ),
        {"workspace_id": str(workspace_id)},
    )
    if int(result.scalar_one()) != 1:
        raise database_unavailable_exception()


async def configure_ai_settings(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
    provider: AiProvider,
    api_key: str,
) -> AiSettingsStatus:
    await require_owner(session, workspace_id, user_id)
    validated_key = validate_key_shape(provider, api_key)
    try:
        result = await session.execute(
            text(
                """
                select provider, key_last4, updated_by, updated_at
                from public.set_workspace_ai_key(
                    cast(:workspace_id as uuid),
                    :provider,
                    :api_key
                )
                """
            ),
            {
                "workspace_id": str(workspace_id),
                "provider": provider.value,
                "api_key": validated_key,
            },
        )
        row = result.first()
        await _assert_single_config(session, workspace_id)
    except DBAPIError as exc:
        raise _rpc_exception(exc) from exc
    if row is None:
        raise database_unavailable_exception()
    return _status_from_row(row)


async def clear_ai_settings(
    session: AsyncSession, workspace_id: UUID, user_id: UUID
) -> AiSettingsStatus:
    await require_owner(session, workspace_id, user_id)
    try:
        await session.execute(
            text("select public.clear_workspace_ai_key(cast(:workspace_id as uuid))"),
            {"workspace_id": str(workspace_id)},
        )
    except DBAPIError as exc:
        raise _rpc_exception(exc) from exc
    return AiSettingsStatus(configured=False)
