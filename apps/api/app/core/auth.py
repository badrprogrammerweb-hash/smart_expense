import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.config import get_settings


@dataclass(frozen=True)
class CurrentUser:
    user_id: UUID
    email: str
    claims: dict[str, Any]
    token: str


_jwks_cache: dict[str, dict[str, Any]] = {}
logger = logging.getLogger(__name__)


def _is_test_or_dev_mode() -> bool:
    app_env = os.getenv("APP_ENV", "").strip().lower()
    return bool(os.getenv("PYTEST_CURRENT_TEST")) or app_env in {
        "test",
        "dev",
        "development",
        "local",
    }


def _sanitized_db_error(exc: DBAPIError) -> str:
    source = exc.orig if getattr(exc, "orig", None) is not None else exc
    message = f"{type(source).__name__}: {source}"
    message = re.sub(r"postgres(?:ql)?://\S+", "postgresql://<redacted>", message)
    message = re.sub(r"(?i)(password=)[^&\s]+", r"\1<redacted>", message)
    message = re.sub(r"(?i)(bearer\s+)[A-Za-z0-9._~+/-]+", r"\1<redacted>", message)
    message = re.sub(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b", "<jwt-redacted>", message)
    return message[:500]


def unauthenticated_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "unauthenticated", "message": "Sign in to continue."},
    )


def bootstrap_unavailable_exception(exc: DBAPIError | None = None) -> HTTPException:
    detail: dict[str, Any] = {
        "code": "workspace_bootstrap_unavailable",
        "message": "Workspace bootstrap is temporarily unavailable.",
    }
    if exc is not None and _is_test_or_dev_mode():
        detail["diagnostic"] = _sanitized_db_error(exc)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=detail,
    )


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise unauthenticated_exception()

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise unauthenticated_exception()
    return token.strip()


async def _jwks(jwks_url: str, *, force_refresh: bool = False) -> dict[str, Any]:
    if force_refresh or jwks_url not in _jwks_cache:
        async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
            response = await client.get(jwks_url)
            response.raise_for_status()
        _jwks_cache[jwks_url] = response.json()
    return _jwks_cache[jwks_url]


async def _signing_key_from_jwks(jwks_url: str, kid: str | None) -> Any:
    for refresh in (False, True):
        jwks = await _jwks(jwks_url, force_refresh=refresh)
        keys = jwks.get("keys", [])
        for key in keys:
            if key.get("kid") == kid or (kid is None and len(keys) == 1):
                return jwt.PyJWK.from_dict(key).key
    raise unauthenticated_exception()


async def verify_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.supabase_url and not settings.supabase_jwt_secret:
        raise unauthenticated_exception()

    try:
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg")
        if algorithm == "HS256" and settings.supabase_jwt_secret:
            claims = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        else:
            signing_key = await _signing_key_from_jwks(settings.jwks_url, header.get("kid"))
            claims = jwt.decode(
                token,
                signing_key,
                algorithms=[algorithm] if algorithm else ["ES256", "RS256"],
                options={"verify_aud": False},
            )
    except (httpx.HTTPError, jwt.PyJWTError, ValueError) as exc:
        raise unauthenticated_exception() from exc

    if not claims.get("sub"):
        raise unauthenticated_exception()
    return claims


async def _repair_personal_workspace(user: CurrentUser) -> None:
    from app.db import get_engine

    engine = get_engine()
    try:
        async with engine.begin() as connection:
            await connection.execute(text("set local lock_timeout = '10s'"))
            await connection.execute(text("set local statement_timeout = '10s'"))
            await connection.execute(text("set local role authenticated"))
            await connection.execute(
                text("select set_config('request.jwt.claims', :claims, true)"),
                {"claims": json.dumps(user.claims)},
            )
            await connection.execute(
                text("select public.ensure_personal_workspace(:user_id, :email)"),
                {"user_id": str(user.user_id), "email": user.email},
            )
    except DBAPIError as exc:
        if _is_test_or_dev_mode():
            logger.warning("Workspace bootstrap repair failed: %s", _sanitized_db_error(exc))
        if await _personal_workspace_exists(user):
            return
        raise bootstrap_unavailable_exception(exc) from exc


async def _personal_workspace_exists(user: CurrentUser) -> bool:
    from app.db import get_engine

    engine = get_engine()
    try:
        async with engine.connect() as connection:
            return bool(
                (
                    await connection.execute(
                        text(
                            """
                            select exists (
                                select 1
                                from public.user_profiles up
                                join public.workspaces w
                                  on w.created_by = up.id
                                 and w.type = 'personal'
                                join public.workspace_memberships wm
                                  on wm.workspace_id = w.id
                                 and wm.user_id = up.id
                                 and wm.role = 'owner'
                                where up.id = :user_id
                            )
                            """
                        ),
                        {"user_id": str(user.user_id)},
                    )
                ).scalar_one()
            )
    except DBAPIError:
        return False


async def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    token = _extract_bearer_token(authorization)
    claims = await verify_access_token(token)

    try:
        user_id = UUID(str(claims["sub"]))
    except (KeyError, ValueError) as exc:
        raise unauthenticated_exception() from exc

    email = str(claims.get("email") or "").strip().lower()
    if not email:
        raise unauthenticated_exception()
    user = CurrentUser(user_id=user_id, email=email, claims=claims, token=token)
    await _repair_personal_workspace(user)
    return user


CurrentUserDependency = Depends(get_current_user)
