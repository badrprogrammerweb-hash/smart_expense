from __future__ import annotations

import importlib
import importlib.util
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import datetime, timezone
from types import ModuleType
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.routing import APIRoute
from sqlalchemy import text

from app.core.auth import CurrentUser, get_current_user
from app.db import get_trusted_session
from app.main import app
from app.routes import extractions as extraction_routes
from app.routes import reports as report_routes
from app.routes import support_purchases as support_routes
from app.services import payment_providers
from app.services.support_purchases import SupportPurchaseRecord


PROTECTED_BUCKETS = {
    "support_checkout": 5,
    "support_verify": 10,
    "ai_extraction": 30,
    "ai_summary": 10,
}


class FakeClock:
    def __init__(self, value: float = 10_000.0) -> None:
        self.value = value

    def __call__(self) -> float:
        return self.value

    def advance(self, seconds: float) -> None:
        self.value += seconds


class SessionProbe:
    def __init__(self) -> None:
        self.calls = 0

    async def dependency(self):
        self.calls += 1
        yield object()


def _rate_limit_module() -> ModuleType:
    assert importlib.util.find_spec("app.core.rate_limit") is not None, (
        "The Phase 5 rate limiter module does not exist."
    )
    return importlib.import_module("app.core.rate_limit")


def _user(label: str) -> CurrentUser:
    user_id = uuid4()
    return CurrentUser(
        user_id=user_id,
        email=f"{label}-{user_id.hex}@example.invalid",
        claims={"sub": str(user_id), "email": f"{label}@example.invalid"},
        token="synthetic-local-token",
    )


def _purchase(
    *,
    user_id: UUID,
    provider_transaction_id: str,
    channel: str = "web",
    amount_minor_units: int = 500,
    status: str = "pending",
) -> SupportPurchaseRecord:
    now = datetime.now(timezone.utc)
    return SupportPurchaseRecord(
        id=uuid4(),
        user_id=user_id,
        tier_id="support_small",
        channel=channel,
        provider_transaction_id=provider_transaction_id,
        amount_minor_units=amount_minor_units,
        currency="SAR",
        status=status,
        failure_reason=None,
        created_at=now,
        updated_at=now,
    )


@pytest.fixture(autouse=True)
def _isolate_rate_limit_state():
    if importlib.util.find_spec("app.core.rate_limit") is not None:
        module = importlib.import_module("app.core.rate_limit")
        module.rate_limiter.reset()
    yield
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_trusted_session, None)
    if importlib.util.find_spec("app.core.rate_limit") is not None:
        module = importlib.import_module("app.core.rate_limit")
        module.rate_limiter.reset()


@pytest.fixture
def use_user():
    def _use(user: CurrentUser) -> None:
        async def current_user_override() -> CurrentUser:
            return user

        app.dependency_overrides[get_current_user] = current_user_override

    return _use


@pytest.fixture
def session_probe() -> SessionProbe:
    probe = SessionProbe()
    app.dependency_overrides[get_trusted_session] = probe.dependency
    return probe


def _assert_rate_limited(response) -> None:
    assert response.status_code == 429, response.text
    assert response.json() == {
        "error": {
            "code": "rate_limited",
            "message": "Too many requests. Try again later.",
        }
    }
    assert "retry-after" not in response.headers
    disclosure = response.text.lower()
    for forbidden in ("allowance", "threshold", "remaining", "reset", "window", "hour"):
        assert forbidden not in disclosure


def _install_success_path(monkeypatch, bucket: str, user: CurrentUser) -> dict[str, int]:
    calls = {"provider": 0, "key": 0, "state": 0, "service": 0}

    if bucket == "support_checkout":
        async def create_checkout(**_: Any):
            calls["provider"] += 1
            session_id = f"cs_test_{uuid4().hex}"
            return payment_providers.StripeCheckoutSession(
                id=session_id,
                url=f"https://checkout.stripe.test/{session_id}",
                amount_minor_units=500,
                currency="SAR",
            )

        async def create_pending(_session, **kwargs: Any):
            calls["state"] += 1
            return _purchase(
                user_id=UUID(str(kwargs["user_id"])),
                provider_transaction_id=kwargs["provider_transaction_id"],
            )

        monkeypatch.setattr(
            support_routes.payment_providers,
            "create_stripe_checkout_session",
            create_checkout,
        )
        monkeypatch.setattr(support_routes, "create_pending", create_pending)

    elif bucket == "support_verify":
        latest: dict[str, SupportPurchaseRecord] = {}

        async def get_existing(*_: Any, **__: Any):
            return None

        def load_roots():
            return ()

        async def verify_apple(**kwargs: Any):
            calls["provider"] += 1
            return payment_providers.VerifiedAppleTransaction(
                provider_transaction_id=kwargs["transaction_id"],
                original_transaction_id=kwargs["transaction_id"],
                product_id="ai.smartexpense.support.small",
                bundle_id=payment_providers.MOBILE_APP_BUNDLE_ID,
                app_account_token=str(user.user_id),
                amount_minor_units=499,
                currency="SAR",
                state="completed",
                payload={},
            )

        async def create_pending(_session, **kwargs: Any):
            calls["state"] += 1
            record = _purchase(
                user_id=UUID(str(kwargs["user_id"])),
                provider_transaction_id=kwargs["provider_transaction_id"],
                channel="ios",
                amount_minor_units=499,
            )
            latest["record"] = record
            return record

        async def mark_completed(*_: Any, **__: Any):
            calls["state"] += 1
            return replace(latest["record"], status="completed")

        monkeypatch.setattr(support_routes, "get_by_provider_transaction", get_existing)
        monkeypatch.setattr(
            support_routes.payment_providers,
            "load_apple_trusted_root_certificates",
            load_roots,
        )
        monkeypatch.setattr(
            support_routes.payment_providers,
            "verify_apple_purchase",
            verify_apple,
        )
        monkeypatch.setattr(support_routes, "create_pending", create_pending)
        monkeypatch.setattr(support_routes, "mark_completed", mark_completed)

    elif bucket == "ai_extraction":
        async def trigger(workspace_id: UUID, file_id: UUID, current_user: CurrentUser):
            calls["service"] += 1
            calls["key"] += 1
            calls["provider"] += 1
            calls["state"] += 1
            return {
                "id": str(uuid4()),
                "workspace_id": str(workspace_id),
                "file_id": str(file_id),
                "provider": "openai",
                "status": "processing",
                "draft": None,
                "failure_reason": None,
                "triggered_by": str(current_user.user_id),
                "triggered_at": datetime.now(timezone.utc).isoformat(),
                "confirmed_by": None,
                "confirmed_at": None,
                "discarded_by": None,
                "discarded_at": None,
                "expense_id": None,
                "can_edit": True,
                "can_discard": True,
            }

        monkeypatch.setattr(extraction_routes, "trigger_extraction", trigger)

    elif bucket == "ai_summary":
        async def generate(*_: Any, **__: Any):
            calls["service"] += 1
            calls["key"] += 1
            calls["provider"] += 1
            calls["state"] += 1
            return {"locale": "en", "text": "Synthetic local summary."}

        monkeypatch.setattr(report_routes, "generate_ai_summary", generate)
    else:  # pragma: no cover - protects the test helper itself
        raise AssertionError(f"Unknown bucket: {bucket}")

    return calls


async def _post_bucket(api_client, bucket: str, index: int):
    if bucket == "support_checkout":
        return await api_client.post(
            "/support-purchases/checkout-sessions",
            json={"tier_id": "support_small", "locale": "en"},
        )
    if bucket == "support_verify":
        return await api_client.post(
            "/support-purchases/mobile/verify",
            json={
                "tier_id": "support_small",
                "channel": "apple",
                "provider_transaction_id": f"phase5-apple-{index}-{uuid4().hex}",
            },
        )
    workspace_id = uuid4()
    if bucket == "ai_extraction":
        return await api_client.post(
            f"/workspaces/{workspace_id}/files/{uuid4()}/extractions"
        )
    return await api_client.post(
        f"/workspaces/{workspace_id}/reports/ai-summary",
        json={"locale": "en"},
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("bucket,allowance", PROTECTED_BUCKETS.items())
async def test_each_bucket_refuses_allowance_plus_one_without_disclosure(
    api_client,
    monkeypatch,
    use_user,
    session_probe,
    bucket: str,
    allowance: int,
) -> None:
    user = _user(f"rl1-{bucket}")
    use_user(user)
    _install_success_path(monkeypatch, bucket, user)

    for index in range(allowance):
        response = await _post_bucket(api_client, bucket, index)
        assert 200 <= response.status_code < 300, response.text

    refused = await _post_bucket(api_client, bucket, allowance)
    _assert_rate_limited(refused)


@pytest.mark.asyncio
async def test_accounts_have_independent_allowances(
    api_client, monkeypatch, use_user, session_probe
) -> None:
    account_a = _user("rl5-a")
    account_b = _user("rl5-b")
    _install_success_path(monkeypatch, "support_checkout", account_a)

    use_user(account_a)
    for index in range(PROTECTED_BUCKETS["support_checkout"]):
        assert (await _post_bucket(api_client, "support_checkout", index)).status_code == 201
    _assert_rate_limited(
        await _post_bucket(api_client, "support_checkout", 99)
    )

    use_user(account_b)
    response = await _post_bucket(api_client, "support_checkout", 0)
    assert response.status_code == 201, response.text


@pytest.mark.asyncio
async def test_window_rollover_allows_the_next_request(
    api_client, monkeypatch, use_user, session_probe
) -> None:
    module = _rate_limit_module()
    clock = FakeClock()
    limiter = module.FixedWindowRateLimiter(clock=clock)
    monkeypatch.setattr(module, "rate_limiter", limiter)
    user = _user("rl6-window")
    use_user(user)
    _install_success_path(monkeypatch, "support_checkout", user)

    for index in range(PROTECTED_BUCKETS["support_checkout"]):
        assert (await _post_bucket(api_client, "support_checkout", index)).status_code == 201
    _assert_rate_limited(await _post_bucket(api_client, "support_checkout", 99))

    clock.advance(3600.001)
    response = await _post_bucket(api_client, "support_checkout", 100)
    assert response.status_code == 201, response.text


@pytest.mark.asyncio
async def test_unauthenticated_request_is_401_not_429(api_client) -> None:
    response = await api_client.post(
        "/support-purchases/checkout-sessions",
        json={"tier_id": "support_small", "locale": "en"},
    )
    assert response.status_code == 401, response.text


@pytest.mark.asyncio
@pytest.mark.parametrize("bucket,allowance", PROTECTED_BUCKETS.items())
async def test_throttled_request_stops_before_session_provider_key_or_state(
    api_client,
    db_connection,
    monkeypatch,
    use_user,
    session_probe,
    bucket: str,
    allowance: int,
) -> None:
    module = _rate_limit_module()
    user = _user(f"ordering-{bucket}")
    use_user(user)
    calls = _install_success_path(monkeypatch, bucket, user)
    for _ in range(allowance):
        assert module.rate_limiter.consume(str(user.user_id), bucket, allowance)

    before = (
        await db_connection.execute(
            text("select count(*) from public.support_purchases where user_id = :user_id"),
            {"user_id": str(user.user_id)},
        )
    ).scalar_one()
    session_calls_before = session_probe.calls

    response = await _post_bucket(api_client, bucket, 1_000)

    after = (
        await db_connection.execute(
            text("select count(*) from public.support_purchases where user_id = :user_id"),
            {"user_id": str(user.user_id)},
        )
    ).scalar_one()
    _assert_rate_limited(response)
    assert session_probe.calls == session_calls_before
    assert calls == {"provider": 0, "key": 0, "state": 0, "service": 0}
    assert after == before == 0


@pytest.mark.asyncio
async def test_webhook_bursts_are_never_throttled(api_client, session_probe) -> None:
    webhook_paths = {
        "/support-purchases/webhooks/stripe": {"content": b"{}"},
        "/support-purchases/webhooks/apple": {"json": {}},
        "/support-purchases/webhooks/google": {"json": {}},
    }
    route_map = {
        route.path: route
        for route in support_routes.router.routes
        if isinstance(route, APIRoute) and route.path in webhook_paths
    }
    assert set(route_map) == set(webhook_paths)
    for route in route_map.values():
        dependency_names = {
            dependency.call.__name__
            for dependency in route.dependant.dependencies
            if dependency.call is not None
        }
        assert not any(name.startswith("rate_limit_") for name in dependency_names)

    for path, request_kwargs in webhook_paths.items():
        for _ in range(max(PROTECTED_BUCKETS.values()) + 5):
            response = await api_client.post(path, **request_kwargs)
            assert response.status_code == 400, response.text
            assert response.status_code != 429


@pytest.mark.asyncio
async def test_internal_limiter_error_fails_closed(
    api_client, monkeypatch, use_user, session_probe
) -> None:
    module = _rate_limit_module()
    user = _user("rl8-fail-closed")
    use_user(user)
    calls = _install_success_path(monkeypatch, "support_checkout", user)

    def broken_consume(*_: Any, **__: Any) -> bool:
        raise RuntimeError("synthetic counter failure")

    monkeypatch.setattr(module.rate_limiter, "consume", broken_consume)
    response = await _post_bucket(api_client, "support_checkout", 0)

    _assert_rate_limited(response)
    assert session_probe.calls == 0
    assert calls == {"provider": 0, "key": 0, "state": 0, "service": 0}


@pytest.mark.asyncio
async def test_duplicate_checkout_creates_one_provider_session_and_one_logical_purchase(
    api_client, monkeypatch, use_user, session_probe
) -> None:
    user = _user("rl10-idempotency")
    use_user(user)
    wall_clock = FakeClock(2_000_000_000.0)
    monkeypatch.setattr(
        support_routes,
        "_checkout_idempotency_clock",
        wall_clock,
        raising=False,
    )
    sessions_by_key: dict[str, payment_providers.StripeCheckoutSession] = {}
    purchases_by_session: dict[str, SupportPurchaseRecord] = {}
    provider_creations = 0

    async def create_checkout(**kwargs: Any):
        nonlocal provider_creations
        key = kwargs["idempotency_key"]
        if key not in sessions_by_key:
            provider_creations += 1
            session_id = f"cs_test_{provider_creations}"
            sessions_by_key[key] = payment_providers.StripeCheckoutSession(
                id=session_id,
                url=f"https://checkout.stripe.test/{session_id}",
                amount_minor_units=500,
                currency="SAR",
            )
        return sessions_by_key[key]

    async def create_pending(_session, **kwargs: Any):
        session_id = kwargs["provider_transaction_id"]
        if session_id not in purchases_by_session:
            purchases_by_session[session_id] = _purchase(
                user_id=UUID(str(kwargs["user_id"])),
                provider_transaction_id=session_id,
            )
        return purchases_by_session[session_id]

    monkeypatch.setattr(
        support_routes.payment_providers,
        "create_stripe_checkout_session",
        create_checkout,
    )
    monkeypatch.setattr(support_routes, "create_pending", create_pending)

    first = await _post_bucket(api_client, "support_checkout", 0)
    second = await _post_bucket(api_client, "support_checkout", 1)

    assert first.status_code == second.status_code == 201
    assert first.json() == second.json()
    assert provider_creations == 1
    assert len(sessions_by_key) == len(purchases_by_session) == 1

    wall_clock.advance(61)
    later = await _post_bucket(api_client, "support_checkout", 2)
    assert later.status_code == 201, later.text
    assert later.json() != first.json()
    assert provider_creations == 2
    assert len(sessions_by_key) == len(purchases_by_session) == 2


def test_counter_is_concurrency_safe_and_bounded() -> None:
    module = _rate_limit_module()
    clock = FakeClock()
    limiter = module.FixedWindowRateLimiter(clock=clock, max_entries=3)

    with ThreadPoolExecutor(max_workers=16) as executor:
        allowed = list(
            executor.map(
                lambda _: limiter.consume("same-account", "support_checkout", 5),
                range(32),
            )
        )
    assert sum(allowed) == 5

    for index in range(4):
        limiter.consume(f"account-{index}", "ai_summary", 10)
    assert limiter.entry_count == 3
