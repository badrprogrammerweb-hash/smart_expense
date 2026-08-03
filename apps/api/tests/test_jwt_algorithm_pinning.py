from __future__ import annotations

import json
import os
import time
from collections.abc import AsyncIterator
from dataclasses import replace
from typing import Any

import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
import pytest
import pytest_asyncio

from app.core import auth
from app.core.config import get_settings
from app.db import get_rls_session
from app.main import app
from conftest import requires_supabase
from supabase_credentials import local_supabase_credential


pytestmark = [pytest.mark.asyncio, requires_supabase]

#: The fixture below pins `supabase_url` to this host, so a token that should
#: verify must declare the issuer derived from it. Claim validation is exercised
#: in detail by `test_supabase_claim_validation.py`; here the claims exist so
#: the algorithm assertions are not masked by an unrelated claim rejection.
_SYNTHETIC_SUPABASE_URL = "http://jwks.invalid"
_SYNTHETIC_ISSUER = f"{_SYNTHETIC_SUPABASE_URL}/auth/v1"
_SYNTHETIC_CLAIMS = {
    "sub": "00000000-0000-4000-8000-000000000007",
    "email": "phase7-user@example.test",
    "iss": _SYNTHETIC_ISSUER,
    "aud": "authenticated",
    "exp": int(time.time()) + 3600,
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


_SYNTHETIC_KID = "phase7-synthetic-rsa"


def _synthetic_rsa_keypair() -> tuple[Any, dict[str, Any]]:
    """A throwaway RSA key and its JWK, generated per run.

    Never a real key: it exists only inside the test process and is discarded
    with it. Generating it here is what makes these assertions deterministic —
    previously the fixture read whatever the live Supabase JWKS endpoint happened
    to publish, which is one key locally and zero in CI.
    """

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_numbers = private_key.public_key().public_numbers()

    def _b64uint(value: int) -> str:
        raw = value.to_bytes((value.bit_length() + 7) // 8, "big")
        return jwt.utils.base64url_encode(raw).decode()

    jwk = {
        "kty": "RSA",
        "kid": _SYNTHETIC_KID,
        "alg": "RS256",
        "use": "sig",
        "n": _b64uint(public_numbers.n),
        "e": _b64uint(public_numbers.e),
    }
    return private_key, jwk


@pytest_asyncio.fixture
async def jwks_only(monkeypatch) -> AsyncIterator[tuple[str, Any]]:
    """Pin verification to synthetic JWKS-only material.

    `supabase_jwt_secret` is cleared so the HS256 branch is unavailable, while
    `supabase_url` is kept non-empty — otherwise `verify_access_token` would
    short-circuit before any algorithm pinning ran and every 401 assertion would
    pass vacuously. The URL is redirected to an unroutable host so that if the
    interception below ever stops working the test fails loudly instead of
    quietly reaching a live endpoint.

    Only the network boundary (`auth._jwks`) is replaced. `_signing_key_from_jwks`,
    its algorithm selection, and `jwt.decode` — the logic actually under test —
    all run for real.
    """

    private_key, jwk = _synthetic_rsa_keypair()
    settings = replace(
        get_settings(),
        supabase_jwt_secret="",
        supabase_url=_SYNTHETIC_SUPABASE_URL,
    )
    monkeypatch.setattr(auth, "get_settings", lambda: settings)

    async def _synthetic_jwks(jwks_url: str, *, force_refresh: bool = False) -> dict[str, Any]:
        assert jwks_url == settings.jwks_url
        return {"keys": [jwk]}

    monkeypatch.setattr(auth, "_jwks", _synthetic_jwks)

    # Resets the JWKS cache *and* the forced-refresh cooldown together; a
    # cooldown left over from another test would otherwise suppress the
    # refresh under test and make results depend on execution order.
    auth._reset_jwks_state()
    try:
        yield _SYNTHETIC_KID, private_key
    finally:
        auth._reset_jwks_state()


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
    # Shared resolver: SUPABASE_<NAME> as exported by CI, else the Supabase CLI
    # whether it is the standalone binary or an npm package.
    return local_supabase_credential(name)


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
    jwks_only: tuple[str, Any],
    guarded_client: tuple[httpx.AsyncClient, list[bool]],
) -> None:
    client, protected_operation_entered = guarded_client
    key_id, _ = jwks_only
    token = _unexpected_algorithm_token(case, key_id)

    response = await client.get("/me", headers={"Authorization": f"Bearer {token}"})

    _assert_normal_unauthenticated_response(response, protected_operation_entered)


async def test_hs256_token_against_jwks_only_material_returns_401(
    jwks_only: tuple[str, Any],
    guarded_client: tuple[httpx.AsyncClient, list[bool]],
) -> None:
    client, protected_operation_entered = guarded_client
    key_id, _ = jwks_only
    token = jwt.encode(
        _SYNTHETIC_CLAIMS,
        "phase7-synthetic-hmac-key-not-used-by-the-server",
        algorithm="HS256",
        headers={"kid": key_id},
    )

    response = await client.get("/me", headers={"Authorization": f"Bearer {token}"})

    _assert_normal_unauthenticated_response(response, protected_operation_entered)


async def test_accepted_asymmetric_algorithm_verifies_against_jwks(
    jwks_only: tuple[str, Any],
) -> None:
    """Positive control for the JWKS path.

    Every other test on this fixture asserts a 401, so a silently broken fixture
    would let them all pass for the wrong reason. This proves the synthetic JWKS
    is really wired in and that a correctly signed RS256 token is accepted by the
    same pinning logic that rejects the cases above.
    """

    key_id, private_key = jwks_only
    token = jwt.encode(
        _SYNTHETIC_CLAIMS,
        private_key,
        algorithm="RS256",
        headers={"kid": key_id},
    )

    claims = await auth.verify_access_token(token)

    assert claims["sub"] == _SYNTHETIC_CLAIMS["sub"]
    assert claims["email"] == _SYNTHETIC_CLAIMS["email"]


@pytest.mark.parametrize(
    "case",
    ["non_string", "one_segment", "invalid_header", "invalid_payload"],
)
async def test_malformed_token_matrix_never_returns_5xx(
    case: str,
    jwks_only: tuple[str, Any],
    guarded_client: tuple[httpx.AsyncClient, list[bool]],
) -> None:
    client, protected_operation_entered = guarded_client
    key_id, _ = jwks_only
    if case == "non_string":
        token = _unexpected_algorithm_token(case, key_id)
    elif case == "one_segment":
        token = "synthetic-malformed-token"
    elif case == "invalid_header":
        token = f"not-json.{_segment(_SYNTHETIC_CLAIMS)}.c3ludGhldGlj"
    else:
        token = f"{_segment({'alg': 'ES256', 'kid': key_id})}.not-json.c3ludGhldGlj"

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
