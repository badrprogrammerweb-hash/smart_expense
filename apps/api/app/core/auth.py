import asyncio
import json
import logging
import os
import re
import time
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.config import get_settings, is_dev_or_test_environment


@dataclass(frozen=True)
class CurrentUser:
    user_id: UUID
    email: str
    claims: dict[str, Any]
    token: str


_jwks_cache: dict[str, dict[str, Any]] = {}
_JWKS_ALGORITHMS = frozenset({"ES256", "RS256"})
_JWKS_ALGORITHM_BY_KEY_TYPE = {"EC": "ES256", "RSA": "RS256"}
logger = logging.getLogger(__name__)

#: Minimum wall-clock gap between two *forced* JWKS refreshes, process-wide.
#:
#: `kid` is read from the unverified token header before any authentication
#: happens, so an unauthenticated client fully controls it. Without a bound,
#: every request carrying a previously unseen `kid` forced its own outbound
#: fetch to the Supabase JWKS endpoint, letting one client amplify unauthorized
#: traffic into our identity provider.
#:
#: 300s is deliberately conservative. Supabase signing keys rotate on the order
#: of days, so a five-minute worst-case delay in noticing a rotation is
#: immaterial, while the bound caps forced refreshes at 12/hour no matter how
#: much unknown-`kid` traffic arrives. Nothing about a *known* key is delayed:
#: cached keys are served without ever consulting this cooldown.
#:
#: NOTE: this throttle is process-local. It bounds amplification per API
#: process/replica, not across a cluster — N replicas permit N forced refreshes
#: per window. That is an intentional trade-off: a globally coordinated limiter
#: would require Redis or a database, which this deployment does not have and
#: which would put a hard dependency in the pre-authentication path.
_JWKS_REFRESH_COOLDOWN_SECONDS = 300.0

#: Serializes forced refreshes so concurrent unknown-`kid` requests coalesce
#: into a single fetch instead of stampeding the JWKS endpoint together.
#:
#: Created lazily and re-bound if the running loop changes. `asyncio.Lock`
#: attaches to the first loop that awaits it, so a module-level instance would
#: raise "bound to a different event loop" as soon as a second loop used it.
#: The server runs one long-lived loop, so this rebinds exactly once in
#: production; the branch exists for test runners that build a loop per test.
_jwks_refresh_lock: asyncio.Lock | None = None
_jwks_refresh_lock_loop: asyncio.AbstractEventLoop | None = None


def _refresh_lock() -> asyncio.Lock:
    global _jwks_refresh_lock, _jwks_refresh_lock_loop

    loop = asyncio.get_running_loop()
    if _jwks_refresh_lock is None or _jwks_refresh_lock_loop is not loop:
        _jwks_refresh_lock = asyncio.Lock()
        _jwks_refresh_lock_loop = loop
    return _jwks_refresh_lock

#: Monotonic timestamp of the last forced refresh attempt, or None if none has
#: happened in this process. Monotonic (not wall-clock) so that NTP steps or
#: DST changes can never widen or disable the window.
_jwks_last_forced_refresh: float | None = None


def _monotonic() -> float:
    """Indirection seam so tests can drive the cooldown without real sleeps."""

    return time.monotonic()


def _reset_jwks_state() -> None:
    """Clear cached JWKS data and the refresh cooldown.

    Tests must reset both together: clearing only the cache would leave a
    cooldown from a previous test suppressing the refresh under test, making
    results depend on execution order.
    """

    global _jwks_last_forced_refresh, _jwks_refresh_lock, _jwks_refresh_lock_loop

    _jwks_cache.clear()
    _jwks_last_forced_refresh = None
    _jwks_refresh_lock = None
    _jwks_refresh_lock_loop = None


def _is_test_or_dev_mode() -> bool:
    app_env = os.getenv("APP_ENV")
    if app_env is None:
        return bool(os.getenv("PYTEST_CURRENT_TEST"))
    return is_dev_or_test_environment(app_env)


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


def _match_signing_key(
    jwks: dict[str, Any], kid: str | None
) -> tuple[Any, str] | None:
    """Resolve a JWKS document to a `(key, algorithm)` pair, or None if absent.

    The algorithm allow-list is unchanged: the algorithm comes from the key's
    own `alg`, falls back to the key type, and must be one of
    `_JWKS_ALGORITHMS`. A key that matches but carries an unusable algorithm
    still rejects immediately rather than reporting "not found" — a refresh
    cannot turn a disallowed algorithm into an allowed one, and treating it as
    a miss would spend the refresh budget on a token that can never verify.
    """

    keys = jwks.get("keys", [])
    for key in keys:
        if key.get("kid") == kid or (kid is None and len(keys) == 1):
            signing_jwk = jwt.PyJWK.from_dict(key)
            algorithm = key.get("alg")
            if algorithm is None:
                algorithm = _JWKS_ALGORITHM_BY_KEY_TYPE.get(
                    signing_jwk.key_type
                )
            if not isinstance(algorithm, str) or algorithm not in _JWKS_ALGORITHMS:
                raise unauthenticated_exception()
            return signing_jwk.key, algorithm
    return None


async def _refresh_jwks_within_cooldown(jwks_url: str) -> dict[str, Any] | None:
    """Fetch JWKS if the cooldown allows, else return None.

    Returns the freshest JWKS document available to the caller, or None when
    no fetch was permitted. Concurrent callers coalesce: the first one performs
    the fetch while the rest wait on the lock and then reuse its result rather
    than issuing fetches of their own.

    This guards *every* network fetch, not just refreshes of an already-cached
    document. An uncached fetch is equally amplifiable: `_jwks` only populates
    its cache on success, so while the endpoint is unreachable — or simply cold
    — an unauthenticated caller would otherwise drive one outbound request per
    request, with no cache ever forming to stop it.
    """

    global _jwks_last_forced_refresh

    # Always take the lock rather than short-circuiting on a lock-free read of
    # the timestamp. A fast path there would let callers that arrive *during*
    # an in-flight fetch see the just-written timestamp, conclude the window is
    # closed, and give up — rejecting a legitimately rotated key that the
    # in-flight fetch was about to deliver. Waiting is what makes coalescing
    # share the result instead of merely suppressing requests. Cache hits never
    # reach this function, so ordinary traffic never contends on this lock.
    async with _refresh_lock():
        # Re-check under the lock. Whoever held it may have just refreshed, in
        # which case we hand back their result — that is what turns a
        # concurrent stampede into a single fetch while still letting every
        # waiter see a newly rotated key.
        last = _jwks_last_forced_refresh
        if last is not None and _monotonic() - last < _JWKS_REFRESH_COOLDOWN_SECONDS:
            return _jwks_cache.get(jwks_url)

        # Consume the budget *before* the fetch, so an endpoint that is failing
        # or slow cannot be used to drive a retry storm. The cost is that a
        # transient JWKS outage delays rotation discovery by one cooldown,
        # which is the safe direction to err.
        _jwks_last_forced_refresh = _monotonic()
        return await _jwks(jwks_url, force_refresh=True)


async def _signing_key_from_jwks(
    jwks_url: str, kid: str | None
) -> tuple[Any, str]:
    # Serve from cache without touching the network whenever possible. This is
    # the path every legitimate request takes, and it is never throttled.
    cached = _jwks_cache.get(jwks_url)
    if cached is not None:
        signing_key = _match_signing_key(cached, kid)
        if signing_key is not None:
            return signing_key

    # Either nothing is cached yet, or this `kid` is absent from what is. The
    # latter is either a genuine key rotation we have not observed or an
    # attacker probing invented values; the two are indistinguishable here, so
    # the fetch is rate-limited rather than made conditional on the token.
    refreshed = await _refresh_jwks_within_cooldown(jwks_url)
    if refreshed is not None:
        signing_key = _match_signing_key(refreshed, kid)
        if signing_key is not None:
            return signing_key

    # Fail closed: an unresolvable `kid` is never authenticated, whether the
    # refresh was skipped, failed, or simply did not contain the key.
    raise unauthenticated_exception()


#: Claims a Supabase access token must carry. `exp` bounds the token's life,
#: `iss` and `aud` bind it to this project's identity provider and audience,
#: and `sub` is the identity everything downstream keys off. PyJWT's `require`
#: only asserts presence; the value checks are `issuer=`/`audience=` plus the
#: explicit type checks in `_assert_supabase_claims`.
_REQUIRED_SUPABASE_CLAIMS = ["exp", "iss", "aud", "sub"]


def _decode_options() -> dict[str, Any]:
    return {
        "require": list(_REQUIRED_SUPABASE_CLAIMS),
        "verify_aud": True,
        "verify_iss": True,
        "verify_exp": True,
    }


def _assert_supabase_claims(claims: dict[str, Any]) -> None:
    """Enforce claim shape that PyJWT's own checks do not cover.

    PyJWT verifies that `iss`/`aud` *match* and that required claims are
    present, but it does not constrain `sub`'s type. A non-string `sub` would
    otherwise reach `UUID(str(claims["sub"]))` in `get_current_user` and could
    stringify into something unintended.
    """

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject.strip():
        raise unauthenticated_exception()


async def verify_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.supabase_url and not settings.supabase_jwt_secret:
        raise unauthenticated_exception()

    # Fail closed when the expected issuer cannot be determined. Leaving `iss`
    # unchecked because it was not configured is exactly the weakness this
    # validation exists to remove, so an unresolvable issuer rejects instead.
    #
    # NOTE: this narrows a previously supported configuration. `SUPABASE_URL`
    # is documented as optional, so a deployment that set only
    # `SUPABASE_JWT_SECRET` used to authenticate; it must now also set
    # `SUPABASE_JWT_ISSUER` (or `SUPABASE_URL`).
    expected_issuer = settings.expected_jwt_issuer
    if not expected_issuer:
        raise unauthenticated_exception()

    try:
        header = jwt.get_unverified_header(token)
        key_id = header.get("kid")
        if settings.supabase_jwt_secret and not key_id:
            # Legacy HS256 fallback for older Supabase projects. It receives
            # the same claim rules as the JWKS path: the signing algorithm
            # differs, the claim shape does not.
            claims = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience=settings.supabase_jwt_audience,
                issuer=expected_issuer,
                options=_decode_options(),
            )
        else:
            signing_key, algorithm = await _signing_key_from_jwks(
                settings.jwks_url, key_id
            )
            claims = jwt.decode(
                token,
                signing_key,
                algorithms=[algorithm],
                audience=settings.supabase_jwt_audience,
                issuer=expected_issuer,
                options=_decode_options(),
            )
    except (httpx.HTTPError, jwt.PyJWTError, TypeError, ValueError) as exc:
        # Every failure collapses into one generic 401: the caller learns that
        # the token was rejected, never which claim betrayed it, and no key
        # material or library exception text is echoed back.
        raise unauthenticated_exception() from exc

    _assert_supabase_claims(claims)
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
                text("select private.ensure_personal_workspace(:user_id, :email)"),
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
