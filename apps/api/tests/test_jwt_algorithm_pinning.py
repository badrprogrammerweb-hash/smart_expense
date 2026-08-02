from __future__ import annotations

import json
import os
import shutil
import subprocess
from collections.abc import AsyncIterator
from dataclasses import replace
from pathlib import Path
from typing import Any

import httpx
import jwt
import pytest
import pytest_asyncio

from app.core import auth
from app.core.config import get_settings
from app.db import get_rls_session
from app.main import app
from conftest import requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

_SYNTHETIC_CLAIMS = {
    "sub": "00000000-0000-4000-8000-000000000007",
    "email": "phase7-user@example.test",
}


def _segment(value: Any) -> str:
    encoded = json.dumps(value, separators=(",", ":")).encode()
    return jwt.utils.base64url_encode(encoded).decode()


def _unsigned_token(header: dict[str, Any], payload: Any = _SYNTHETIC_CLAIMS) -> str:
    return f"{_segment(header)}.{_segment(payload)}.c3ludGhldGlj"


def _unexpected_algorithm_token(case: str, key_id: str) -> str:
    if case == "none":
        return _unsigned_token({"alg": "none", "kid": key_id, "typ": "JWT"})
    if case == "unknown":
        return _unsigned_token(
            {"alg": "SYNTHETIC-UNSUPPORTED", "kid": key_id, "typ": "JWT"}
        )
    if case == "absent":
        return _unsigned_token({"kid": key_id, "typ": "JWT"})
    if case == "non_string":
        return _unsigned_token({"alg": {"invalid": True}, "kid": key_id})
    raise AssertionError(f"Unhandled synthetic token case: {case}")


@pytest_asyncio.fixture
async def jwks_only(monkeypatch) -> AsyncIterator[str]:
    settings = replace(get_settings(), supabase_jwt_secret="")
    monkeypatch.setattr(auth, "get_settings", lambda: settings)
    auth._jwks_cache.clear()
    keys = (await auth._jwks(settings.jwks_url)).get("keys", [])
    assert len(keys) == 1
    key_id = keys[0].get("kid")
    assert isinstance(key_id, str) and key_id
    yield key_id
    auth._jwks_cache.clear()


@pytest_asyncio.fixture
async def guarded_client() -> AsyncIterator[tuple[httpx.AsyncClient, list[bool]]]:
    protected_operation_entered: list[bool] = []

    async def forbidden_protected_operation():
        protected_operation_entered.append(True)
        raise AssertionError("Malformed authentication reached the protected operation")
        yield  # pragma: no cover

    app.dependency_overrides[get_rls_session] = forbidden_protected_operation
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        yield client, protected_operation_entered
    app.dependency_overrides.pop(get_rls_session, None)


def _local_supabase_status_value(name: str) -> str:
    npx = shutil.which("npx")
    assert npx is not None, "Local Supabase CLI is required for credential controls"
    result = subprocess.run(
        [npx, "--no-install", "supabase", "status", "-o", "env"],
        cwd=Path(__file__).resolve().parents[3],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, "Local Supabase status command failed"
    for line in result.stdout.splitlines():
        key, separator, value = line.partition("=")
        if separator and key == name:
            return value.strip().strip('"')
    return ""


def _assert_normal_unauthenticated_response(
    response: httpx.Response, protected_operation_entered: list[bool]
) -> None:
    assert response.status_code == 401
    assert not 500 <= response.status_code < 600
    assert response.json() == {
        "error": {"code": "unauthenticated", "message": "Sign in to continue."}
    }
    response_text = response.text.lower()
    for internal_detail in ("traceback", "typeerror", "pyjwt", "force_bytes"):
        assert internal_detail not in response_text
    assert protected_operation_entered == []


@pytest.mark.parametrize("case", ["none", "unknown", "absent"])
async def test_unexpected_or_absent_algorithm_returns_401(
    case: str,
    jwks_only: str,
    guarded_client: tuple[httpx.AsyncClient, list[bool]],
) -> None:
    client, protected_operation_entered = guarded_client
    token = _unexpected_algorithm_token(case, jwks_only)

    response = await client.get("/me", headers={"Authorization": f"Bearer {token}"})

    _assert_normal_unauthenticated_response(response, protected_operation_entered)


async def test_hs256_token_against_jwks_only_material_returns_401(
    jwks_only: str,
    guarded_client: tuple[httpx.AsyncClient, list[bool]],
) -> None:
    client, protected_operation_entered = guarded_client
    token = jwt.encode(
        _SYNTHETIC_CLAIMS,
        "phase7-synthetic-hmac-key-not-used-by-the-server",
        algorithm="HS256",
        headers={"kid": jwks_only},
    )

    response = await client.get("/me", headers={"Authorization": f"Bearer {token}"})

    _assert_normal_unauthenticated_response(response, protected_operation_entered)


@pytest.mark.parametrize(
    "case",
    ["non_string", "one_segment", "invalid_header", "invalid_payload"],
)
async def test_malformed_token_matrix_never_returns_5xx(
    case: str,
    jwks_only: str,
    guarded_client: tuple[httpx.AsyncClient, list[bool]],
) -> None:
    client, protected_operation_entered = guarded_client
    if case == "non_string":
        token = _unexpected_algorithm_token(case, jwks_only)
    elif case == "one_segment":
        token = "synthetic-malformed-token"
    elif case == "invalid_header":
        token = f"not-json.{_segment(_SYNTHETIC_CLAIMS)}.c3ludGhldGlj"
    else:
        token = f"{_segment({'alg': 'ES256', 'kid': jwks_only})}.not-json.c3ludGhldGlj"

    response = await client.get("/me", headers={"Authorization": f"Bearer {token}"})

    _assert_normal_unauthenticated_response(response, protected_operation_entered)


async def test_legitimately_issued_local_user_token_is_accepted(
    api_client, signup_user
) -> None:
    user = await signup_user("phase7-legitimate")

    response = await api_client.get("/me", headers=user.auth_header)

    assert response.status_code == 200
    assert response.json()["id"] == user.user_id
    assert response.json()["email"] == user.email


@pytest.mark.parametrize(
    "credential_env",
    ["SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
)
async def test_service_level_credentials_remain_rejected_as_user_tokens(
    credential_env: str, api_client
) -> None:
    credential = os.environ.get(credential_env, "").strip()
    if credential_env == "SUPABASE_ANON_KEY" and not credential:
        credential = _local_supabase_status_value("ANON_KEY")
    assert credential, f"{credential_env} must be configured for the local test"
    secret = get_settings().supabase_jwt_secret
    assert secret, "Local HS256 verification secret must be configured"
    claims = jwt.decode(
        credential,
        secret,
        algorithms=["HS256"],
        options={"verify_aud": False},
    )
    assert not claims.get("sub")
    assert not claims.get("email")

    response = await api_client.get(
        "/me", headers={"Authorization": f"Bearer {credential}"}
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"
