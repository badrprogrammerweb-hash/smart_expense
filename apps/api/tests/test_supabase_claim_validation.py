"""Supabase access-token claim validation.

Claim expectations here are grounded in a real token issued by this project's
local Supabase stack, which decodes with:

    "iss": "<SUPABASE_URL>/auth/v1"
    "aud": "authenticated"

Both branches of `verify_access_token` are exercised through the same
parametrized cases, so the legacy HS256 fallback cannot silently drift into
accepting tokens the JWKS path rejects.

A caveat worth stating plainly: local Supabase issues **ES256** tokens, so
there is no real-world HS256 *user* token to sample. The HS256 cases below are
synthetic tokens minted by this test. They prove the code path applies the same
rules; they are not evidence about the claim shape of legacy Supabase projects.
"""

from __future__ import annotations

import time
from dataclasses import replace
from typing import Any

import httpx
import jwt
import pytest
import pytest_asyncio
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core import auth
from app.core.config import get_settings
from app.db import get_rls_session
from app.main import app


pytestmark = pytest.mark.asyncio

_SUPABASE_URL = "http://claims.invalid"
_ISSUER = f"{_SUPABASE_URL}/auth/v1"
_AUDIENCE = "authenticated"
_SUBJECT = "00000000-0000-4000-8000-000000000099"
_HS256_SECRET = "claim-validation-synthetic-secret-not-a-real-key"
_KID = "claim-validation-kid"

BRANCHES = ["hs256", "jwks"]


def _valid_claims(**overrides: Any) -> dict[str, Any]:
    claims: dict[str, Any] = {
        "sub": _SUBJECT,
        "email": "claims@example.test",
        "iss": _ISSUER,
        "aud": _AUDIENCE,
        "exp": int(time.time()) + 3600,
    }
    claims.update(overrides)
    # A sentinel of None means "omit this claim entirely", which is how the
    # missing-claim cases are expressed without a second helper.
    return {key: value for key, value in claims.items() if value is not None}


class _Minter:
    """Mints tokens for one verification branch."""

    def __init__(self, branch: str, private_key: Any) -> None:
        self.branch = branch
        self._private_key = private_key

    def __call__(self, claims: dict[str, Any]) -> str:
        if self.branch == "hs256":
            # No `kid` — that is what routes the token to the legacy branch.
            return jwt.encode(claims, _HS256_SECRET, algorithm="HS256")
        return jwt.encode(
            claims, self._private_key, algorithm="RS256", headers={"kid": _KID}
        )


@pytest_asyncio.fixture(params=BRANCHES)
async def minter(request, monkeypatch) -> _Minter:
    """Configure settings for one branch and return its token minter."""

    branch = request.param
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    numbers = private_key.public_key().public_numbers()

    def _b64uint(value: int) -> str:
        raw = value.to_bytes((value.bit_length() + 7) // 8, "big")
        return jwt.utils.base64url_encode(raw).decode()

    settings = replace(
        get_settings(),
        supabase_url=_SUPABASE_URL,
        supabase_jwt_issuer="",
        supabase_jwt_audience=_AUDIENCE,
        # The HS256 branch is only reachable when a secret is configured; the
        # JWKS branch requires it to be absent so a `kid`-less token cannot
        # fall back.
        supabase_jwt_secret=_HS256_SECRET if branch == "hs256" else "",
    )
    monkeypatch.setattr(auth, "get_settings", lambda: settings)

    async def _synthetic_jwks(
        jwks_url: str, *, force_refresh: bool = False
    ) -> dict[str, Any]:
        # Populates `_jwks_cache` exactly as the real `_jwks` does. Without
        # that, every call would miss the cache and be gated by the refresh
        # cooldown, so any test making more than one verification would fail
        # for throttling reasons rather than the claim reason under test.
        document = {
            "keys": [
                {
                    "kty": "RSA",
                    "kid": _KID,
                    "alg": "RS256",
                    "use": "sig",
                    "n": _b64uint(numbers.n),
                    "e": _b64uint(numbers.e),
                }
            ]
        }
        auth._jwks_cache[jwks_url] = document
        return document

    monkeypatch.setattr(auth, "_jwks", _synthetic_jwks)
    auth._reset_jwks_state()
    try:
        yield _Minter(branch, private_key)
    finally:
        auth._reset_jwks_state()


async def _assert_rejected(token: str) -> None:
    with pytest.raises(auth.HTTPException) as failure:
        await auth.verify_access_token(token)
    assert failure.value.status_code == 401
    assert failure.value.detail == {
        "code": "unauthenticated",
        "message": "Sign in to continue.",
    }


async def test_valid_token_is_accepted(minter) -> None:
    claims = await auth.verify_access_token(minter(_valid_claims()))

    assert claims["sub"] == _SUBJECT
    assert claims["iss"] == _ISSUER
    assert claims["aud"] == _AUDIENCE


@pytest.mark.parametrize(
    ("case", "overrides"),
    [
        ("wrong_issuer", {"iss": "https://attacker.example/auth/v1"}),
        ("missing_issuer", {"iss": None}),
        ("wrong_audience", {"aud": "anon"}),
        ("missing_audience", {"aud": None}),
        ("missing_expiration", {"exp": None}),
        ("expired", {"exp": int(time.time()) - 60}),
        ("missing_subject", {"sub": None}),
        ("empty_subject", {"sub": ""}),
        ("whitespace_subject", {"sub": "   "}),
        ("non_string_subject", {"sub": 12345}),
        ("malformed_audience_type", {"aud": {"not": "a-string"}}),
        ("audience_list_without_expected", {"aud": ["anon", "service_role"]}),
    ],
)
async def test_invalid_claims_are_rejected(minter, case: str, overrides) -> None:
    """Each case must fail on both branches — the parametrized `minter`
    guarantees HS256 and JWKS receive identical treatment."""

    await _assert_rejected(minter(_valid_claims(**overrides)))


async def test_audience_list_containing_expected_value_is_accepted(minter) -> None:
    """A list-valued `aud` is legitimate per RFC 7519 when it contains ours."""

    token = minter(_valid_claims(aud=[_AUDIENCE, "another-audience"]))

    claims = await auth.verify_access_token(token)

    assert _AUDIENCE in claims["aud"]


async def test_issuer_override_is_honoured(monkeypatch, minter) -> None:
    """An explicit `SUPABASE_JWT_ISSUER` wins over the derived value."""

    custom_issuer = "https://auth.smartexpense.example/auth/v1"
    settings = replace(
        auth.get_settings(), supabase_jwt_issuer=custom_issuer
    )
    monkeypatch.setattr(auth, "get_settings", lambda: settings)

    # The derived issuer is now the wrong one.
    await _assert_rejected(minter(_valid_claims()))

    claims = await auth.verify_access_token(minter(_valid_claims(iss=custom_issuer)))
    assert claims["iss"] == custom_issuer


async def test_unresolvable_issuer_fails_closed(monkeypatch, minter) -> None:
    """No `SUPABASE_URL` and no explicit issuer must reject, not skip the check.

    This deliberately narrows a previously supported configuration: a
    deployment that set only `SUPABASE_JWT_SECRET` used to authenticate.
    """

    settings = replace(
        auth.get_settings(),
        supabase_url="",
        supabase_jwt_issuer="",
        supabase_jwt_secret=_HS256_SECRET,
    )
    monkeypatch.setattr(auth, "get_settings", lambda: settings)

    await _assert_rejected(minter(_valid_claims()))


@pytest_asyncio.fixture
async def guarded_client(minter):
    """An HTTP client whose protected operation must never be reached."""

    entered: list[bool] = []

    async def forbidden_protected_operation():
        entered.append(True)
        raise AssertionError("A rejected token reached the protected operation")
        yield  # pragma: no cover

    app.dependency_overrides[get_rls_session] = forbidden_protected_operation
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        yield client, entered, minter
    app.dependency_overrides.pop(get_rls_session, None)


@pytest.mark.parametrize(
    ("case", "overrides"),
    [
        ("wrong_issuer", {"iss": "https://attacker.example/auth/v1"}),
        ("wrong_audience", {"aud": "anon"}),
        ("expired", {"exp": int(time.time()) - 60}),
        ("non_string_subject", {"sub": 12345}),
    ],
)
async def test_claim_rejections_stay_sanitized_over_http(
    guarded_client, case: str, overrides
) -> None:
    """The client learns only that the token failed — never which claim, nor
    any key material, token bytes, or library exception text."""

    client, entered, minter = guarded_client
    token = minter(_valid_claims(**overrides))

    response = await client.get(
        "/me", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "unauthenticated", "message": "Sign in to continue."}
    }
    body = response.text.lower()
    # No claim-level detail that would let an attacker tune a forgery.
    for leak in ("iss", "aud", "issuer", "audience", "expired", "signature"):
        assert leak not in body
    # No token bytes, secret material, or internal exception plumbing.
    for leak in (token.lower(), _HS256_SECRET.lower(), "traceback", "pyjwt"):
        assert leak not in body
    assert entered == []
