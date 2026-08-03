"""JWKS forced-refresh amplification bounds.

`kid` is attacker-controlled and read before authentication, so an unknown
`kid` must not translate one-for-one into outbound JWKS fetches. These tests
drive `auth._monotonic` directly instead of sleeping, so the cooldown window is
exercised deterministically and the suite stays fast.

Every test here asserts on *fetch counts* as well as outcomes: a change that
kept returning 401 while restoring per-request refreshes would still be the
vulnerability, and would still pass an outcome-only assertion.
"""

from __future__ import annotations

import asyncio
import json
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


pytestmark = pytest.mark.asyncio

_SUPABASE_URL = "http://jwks-throttle.invalid"
#: Claims must satisfy the issuer/audience/expiry rules enforced by
#: `verify_access_token`; this suite is about fetch counts, not claim shape, so
#: the tokens it mints are otherwise valid.
_CLAIMS = {
    "sub": "00000000-0000-4000-8000-000000000042",
    "email": "jwks-throttle@example.test",
    "iss": f"{_SUPABASE_URL}/auth/v1",
    "aud": "authenticated",
    "exp": int(time.time()) + 3600,
}
_KNOWN_KID = "throttle-known-kid"
_ROTATED_KID = "throttle-rotated-kid"


def _rsa_jwk(kid: str) -> tuple[Any, dict[str, Any]]:
    """A throwaway RSA keypair and its JWK, generated per call."""

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    numbers = private_key.public_key().public_numbers()

    def _b64uint(value: int) -> str:
        raw = value.to_bytes((value.bit_length() + 7) // 8, "big")
        return jwt.utils.base64url_encode(raw).decode()

    return private_key, {
        "kty": "RSA",
        "kid": kid,
        "alg": "RS256",
        "use": "sig",
        "n": _b64uint(numbers.n),
        "e": _b64uint(numbers.e),
    }


class _Clock:
    """A monotonic clock the test advances explicitly."""

    def __init__(self) -> None:
        self.now = 1_000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


class _JwksEndpoint:
    """Counts fetches so amplification is measured, not assumed."""

    def __init__(self, keys: list[dict[str, Any]]) -> None:
        self.keys = keys
        self.fetches = 0
        self.fail = False
        self.delay = 0.0

    async def __call__(
        self, jwks_url: str, *, force_refresh: bool = False
    ) -> dict[str, Any]:
        # Mirrors the real `_jwks`: a cached document is returned without any
        # network access, and only `force_refresh` re-fetches.
        if not force_refresh and jwks_url in auth._jwks_cache:
            return auth._jwks_cache[jwks_url]

        self.fetches += 1
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.fail:
            raise httpx.ConnectError("synthetic JWKS outage")

        document = {"keys": list(self.keys)}
        auth._jwks_cache[jwks_url] = document
        return document


@pytest_asyncio.fixture
async def jwks_env(monkeypatch):
    """Wire synthetic JWKS material, a controllable clock, and a fetch counter.

    Only the network boundary (`auth._jwks`) and the clock are replaced. The
    cooldown logic, key matching, and algorithm pinning all run for real.
    """

    private_key, known_jwk = _rsa_jwk(_KNOWN_KID)
    settings = replace(
        get_settings(),
        supabase_jwt_secret="",
        supabase_url=_SUPABASE_URL,
    )
    monkeypatch.setattr(auth, "get_settings", lambda: settings)

    endpoint = _JwksEndpoint([known_jwk])
    clock = _Clock()
    monkeypatch.setattr(auth, "_jwks", endpoint)
    monkeypatch.setattr(auth, "_monotonic", clock)

    auth._reset_jwks_state()
    try:
        yield endpoint, clock, private_key
    finally:
        auth._reset_jwks_state()


def _token_with_kid(kid: str, key: Any = None) -> str:
    """A syntactically valid token for `kid`, signed only if a key is given."""

    if key is not None:
        return jwt.encode(_CLAIMS, key, algorithm="RS256", headers={"kid": kid})

    def _segment(value: Any) -> str:
        return jwt.utils.base64url_encode(
            json.dumps(value, separators=(",", ":")).encode()
        ).decode()

    header = _segment({"alg": "RS256", "kid": kid, "typ": "JWT"})
    return f"{header}.{_segment(_CLAIMS)}.c3ludGhldGlj"


async def test_many_unknown_kids_in_one_cooldown_force_at_most_one_refresh(
    jwks_env,
) -> None:
    """Requirement 1: unknown-`kid` volume must not scale outbound fetches."""

    endpoint, _clock, _key = jwks_env

    for index in range(25):
        with pytest.raises(auth.HTTPException) as failure:
            await auth.verify_access_token(_token_with_kid(f"unknown-{index}"))
        # Requirement 2: every unknown key still fails authentication.
        assert failure.value.status_code == 401

    # Exactly one outbound fetch for the whole window — not one per distinct
    # `kid`. The cold-start fetch is itself budgeted, so 25 unknown keys cost
    # a single request rather than 25.
    assert endpoint.fetches == 1


async def test_known_cached_kid_never_forces_a_refresh(jwks_env) -> None:
    """Requirement 3: a cache hit must not consult the network at all."""

    endpoint, _clock, private_key = jwks_env

    for _ in range(5):
        claims = await auth.verify_access_token(
            _token_with_kid(_KNOWN_KID, private_key)
        )
        assert claims["sub"] == _CLAIMS["sub"]

    # Only the initial population; repeated known keys add nothing.
    assert endpoint.fetches == 1


async def test_rotated_key_becomes_discoverable_after_the_cooldown(
    jwks_env,
) -> None:
    """Requirement 4: throttling must not make rotation undiscoverable."""

    endpoint, clock, _key = jwks_env
    rotated_private, rotated_jwk = _rsa_jwk(_ROTATED_KID)
    rotated_token = _token_with_kid(_ROTATED_KID, rotated_private)

    # Before rotation is published the token is unknown, and the one permitted
    # refresh in this window is spent without finding it.
    with pytest.raises(auth.HTTPException):
        await auth.verify_access_token(rotated_token)
    fetches_after_first_window = endpoint.fetches

    # The provider rotates. Still inside the cooldown, so no new fetch happens
    # and the new key stays undiscovered — the deliberate trade-off.
    endpoint.keys.append(rotated_jwk)
    with pytest.raises(auth.HTTPException):
        await auth.verify_access_token(rotated_token)
    assert endpoint.fetches == fetches_after_first_window

    # Once the window elapses the next request rediscovers the key and the
    # legitimately rotated token authenticates.
    clock.advance(auth._JWKS_REFRESH_COOLDOWN_SECONDS + 1)
    claims = await auth.verify_access_token(rotated_token)
    assert claims["sub"] == _CLAIMS["sub"]
    assert endpoint.fetches == fetches_after_first_window + 1


async def test_concurrent_unknown_kids_coalesce_into_one_fetch(jwks_env) -> None:
    """Requirement 5: a concurrent stampede must not bypass the cooldown."""

    endpoint, _clock, _key = jwks_env
    # Hold the fetch open so every task is inside the refresh path together;
    # without coalescing each would issue its own request.
    endpoint.delay = 0.05

    results = await asyncio.gather(
        *(
            auth.verify_access_token(_token_with_kid(f"concurrent-{index}"))
            for index in range(12)
        ),
        return_exceptions=True,
    )

    assert all(isinstance(result, auth.HTTPException) for result in results)
    assert all(result.status_code == 401 for result in results)
    # A single coalesced fetch serves all twelve concurrent requests.
    assert endpoint.fetches == 1


async def test_concurrent_requests_still_see_a_rotated_key(jwks_env) -> None:
    """Coalescing must share the refreshed document, not just suppress fetches.

    A waiter that is denied a refresh and also denied the fresh result would
    spuriously reject a token signed by a newly rotated key.
    """

    endpoint, _clock, _key = jwks_env
    rotated_private, rotated_jwk = _rsa_jwk(_ROTATED_KID)
    endpoint.delay = 0.05
    endpoint.keys.append(rotated_jwk)

    results = await asyncio.gather(
        *(
            auth.verify_access_token(
                _token_with_kid(_ROTATED_KID, rotated_private)
            )
            for _ in range(8)
        )
    )

    assert all(result["sub"] == _CLAIMS["sub"] for result in results)
    assert endpoint.fetches <= 2


async def test_jwks_outage_fails_authentication_closed(jwks_env) -> None:
    """Requirement 6: a broken JWKS endpoint must never authenticate anyone."""

    endpoint, clock, _key = jwks_env
    endpoint.fail = True

    with pytest.raises(auth.HTTPException) as failure:
        await auth.verify_access_token(_token_with_kid("unknown-during-outage"))
    assert failure.value.status_code == 401

    # A failed refresh still consumes the window, so an unreachable endpoint
    # cannot be used to drive a retry storm.
    fetches_after_failure = endpoint.fetches
    with pytest.raises(auth.HTTPException):
        await auth.verify_access_token(_token_with_kid("unknown-during-outage-2"))
    assert endpoint.fetches == fetches_after_failure

    clock.advance(auth._JWKS_REFRESH_COOLDOWN_SECONDS + 1)
    with pytest.raises(auth.HTTPException):
        await auth.verify_access_token(_token_with_kid("unknown-after-window"))
    assert endpoint.fetches == fetches_after_failure + 1


async def test_algorithm_pinning_survives_the_throttle(jwks_env) -> None:
    """Requirement 7: the allow-list still rejects before any refresh is spent.

    A JWKS entry that matches the `kid` but advertises a disallowed algorithm
    must reject immediately. Treating it as a miss would both weaken pinning
    and burn the refresh budget on a token that can never verify.
    """

    endpoint, _clock, _key = jwks_env
    endpoint.keys.append(
        {
            "kty": "oct",
            "kid": "symmetric-kid",
            "alg": "HS256",
            # 32 bytes, so the entry is rejected for its algorithm rather than
            # incidentally for an undersized key.
            "k": jwt.utils.base64url_encode(b"s" * 32).decode(),
        }
    )
    # Populate the cache so the next call is a pure cache hit.
    with pytest.raises(auth.HTTPException):
        await auth.verify_access_token(_token_with_kid("prime-the-cache"))
    fetches_before = endpoint.fetches

    with pytest.raises(auth.HTTPException) as failure:
        await auth.verify_access_token(_token_with_kid("symmetric-kid"))

    assert failure.value.status_code == 401
    assert endpoint.fetches == fetches_before
