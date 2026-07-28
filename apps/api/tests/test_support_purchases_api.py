import asyncio
from dataclasses import replace
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text

from app.core.config import get_settings
from app.services import payment_providers
from conftest import requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


async def test_list_tiers_returns_three_server_configured_presets(
    api_client, signup_user
) -> None:
    user = await signup_user("support-tiers")

    response = await api_client.get(
        "/support-purchases/tiers", headers=user.auth_header
    )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "tiers": [
            {
                "tier_id": "support_small",
                "label": "Small support",
                "display_amount": "5.00",
                "currency": "SAR",
            },
            {
                "tier_id": "support_medium",
                "label": "Medium support",
                "display_amount": "15.00",
                "currency": "SAR",
            },
            {
                "tier_id": "support_large",
                "label": "Large support",
                "display_amount": "50.00",
                "currency": "SAR",
            },
        ]
    }


async def test_list_tiers_requires_authentication(api_client) -> None:
    response = await api_client.get("/support-purchases/tiers")
    assert response.status_code == 401


async def test_checkout_session_creates_pending_row_for_exact_stripe_session_id(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-checkout")
    checkout_session_id = f"cs_test_{uuid4().hex}"
    captured: dict[str, str] = {}

    async def fake_create_checkout_session(**kwargs):
        captured.update(kwargs)
        return payment_providers.StripeCheckoutSession(
            id=checkout_session_id,
            url=f"https://checkout.stripe.com/c/pay/{checkout_session_id}",
            amount_minor_units=500,
            currency="SAR",
        )

    monkeypatch.setattr(
        payment_providers,
        "create_stripe_checkout_session",
        fake_create_checkout_session,
    )

    response = await api_client.post(
        "/support-purchases/checkout-sessions",
        headers=user.auth_header,
        json={"tier_id": "support_small", "locale": "en"},
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["checkout_url"] == (
        f"https://checkout.stripe.com/c/pay/{checkout_session_id}"
    )
    assert captured["price_id"] == "price_support_small"
    assert captured["user_id"] == user.user_id
    assert captured["tier_id"] == "support_small"
    assert captured["success_url"].endswith(
        "/en/settings/support/result?session_id={CHECKOUT_SESSION_ID}"
    )
    assert captured["cancel_url"].endswith(
        "/en/settings/support/result?session_id={CHECKOUT_SESSION_ID}"
    )

    row = (
        await db_connection.execute(
            text(
                """
                select id, user_id, tier_id, channel, provider_transaction_id,
                       amount_minor_units, currency, status
                from public.support_purchases
                where id = :purchase_id
                """
            ),
            {"purchase_id": payload["purchase_id"]},
        )
    ).one()
    assert str(row.user_id) == user.user_id
    assert row.tier_id == "support_small"
    assert row.channel == "web"
    assert row.provider_transaction_id == checkout_session_id
    assert row.amount_minor_units == 500
    assert row.currency == "SAR"
    assert row.status == "pending"


async def test_unknown_tier_is_rejected_before_stripe_and_creates_no_row(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-unknown-tier")
    called = False

    async def should_not_call_stripe(**kwargs):
        nonlocal called
        called = True
        raise AssertionError("Stripe must not be called for an unknown tier.")

    monkeypatch.setattr(
        payment_providers,
        "create_stripe_checkout_session",
        should_not_call_stripe,
    )

    before = (
        await db_connection.execute(
            text(
                "select count(*) from public.support_purchases where user_id = :user_id"
            ),
            {"user_id": user.user_id},
        )
    ).scalar_one()
    response = await api_client.post(
        "/support-purchases/checkout-sessions",
        headers=user.auth_header,
        json={"tier_id": "custom_999", "locale": "en"},
    )
    after = (
        await db_connection.execute(
            text(
                "select count(*) from public.support_purchases where user_id = :user_id"
            ),
            {"user_id": user.user_id},
        )
    ).scalar_one()

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "unknown_support_tier"
    assert called is False
    assert after == before


async def test_unauthenticated_checkout_never_calls_stripe_or_creates_a_row(
    api_client, db_connection, monkeypatch
) -> None:
    called = False

    async def should_not_call_stripe(**kwargs):
        nonlocal called
        called = True
        raise AssertionError("Stripe must not be called without authentication.")

    monkeypatch.setattr(
        payment_providers,
        "create_stripe_checkout_session",
        should_not_call_stripe,
    )
    before = (
        await db_connection.execute(text("select count(*) from public.support_purchases"))
    ).scalar_one()

    response = await api_client.post(
        "/support-purchases/checkout-sessions",
        json={"tier_id": "support_small", "locale": "en"},
    )

    after = (
        await db_connection.execute(text("select count(*) from public.support_purchases"))
    ).scalar_one()
    assert response.status_code == 401
    assert called is False
    assert after == before


async def test_result_status_uses_query_reference_only_for_owned_backend_lookup(
    api_client, signup_user, monkeypatch
) -> None:
    owner = await signup_user("support-status-owner")
    other_user = await signup_user("support-status-other")
    checkout_session_id = f"cs_test_{uuid4().hex}"

    async def fake_create_checkout_session(**kwargs):
        return payment_providers.StripeCheckoutSession(
            id=checkout_session_id,
            url=f"https://checkout.stripe.com/c/pay/{checkout_session_id}",
            amount_minor_units=500,
            currency="SAR",
        )

    monkeypatch.setattr(
        payment_providers,
        "create_stripe_checkout_session",
        fake_create_checkout_session,
    )
    checkout = await api_client.post(
        "/support-purchases/checkout-sessions",
        headers=owner.auth_header,
        json={"tier_id": "support_small", "locale": "en"},
    )
    assert checkout.status_code == 201, checkout.text

    response = await api_client.get(
        f"/support-purchases/session/{checkout_session_id}?status=completed",
        headers=owner.auth_header,
    )
    forbidden_lookup = await api_client.get(
        f"/support-purchases/session/{checkout_session_id}",
        headers=other_user.auth_header,
    )

    assert response.status_code == 200, response.text
    assert response.json()["id"] == checkout.json()["purchase_id"]
    assert response.json()["status"] == "pending"
    assert forbidden_lookup.status_code == 404


def _verified_apple(
    *,
    transaction_id: str,
    user_id: str,
    state: payment_providers.StorePurchaseState = "completed",
) -> payment_providers.VerifiedAppleTransaction:
    return payment_providers.VerifiedAppleTransaction(
        provider_transaction_id=transaction_id,
        original_transaction_id=transaction_id,
        product_id="ai.smartexpense.support.small",
        bundle_id=payment_providers.MOBILE_APP_BUNDLE_ID,
        app_account_token=user_id,
        amount_minor_units=499,
        currency="SAR",
        state=state,
        payload={},
    )


def _verified_google(
    *,
    purchase_token: str,
    user_id: str,
    state: payment_providers.StorePurchaseState = "completed",
) -> payment_providers.VerifiedGooglePurchase:
    return payment_providers.VerifiedGooglePurchase(
        provider_transaction_id=purchase_token,
        product_id="ai.smartexpense.support.small",
        package_name=payment_providers.MOBILE_APP_BUNDLE_ID,
        app_account_token=user_id,
        amount_minor_units=599,
        currency="SAR",
        state=state,
        payload={},
    )


async def test_mobile_apple_verification_creates_pending_then_completes_from_server_result(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-mobile-apple")
    transaction_id = str(10**15 + int(uuid4().hex[:10], 16))
    calls: list[dict] = []

    monkeypatch.setattr(
        payment_providers,
        "load_apple_trusted_root_certificates",
        lambda: (b"trusted-test-root",),
    )

    async def fake_verify_apple_purchase(**kwargs):
        calls.append(kwargs)
        return _verified_apple(
            transaction_id=transaction_id,
            user_id=user.user_id,
        )

    monkeypatch.setattr(
        payment_providers,
        "verify_apple_purchase",
        fake_verify_apple_purchase,
    )

    response = await api_client.post(
        "/support-purchases/mobile/verify",
        headers=user.auth_header,
        json={
            "tier_id": "support_small",
            "channel": "apple",
            "provider_transaction_id": transaction_id,
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "completed"
    assert payload["channel"] == "ios"
    assert payload["amount_minor_units"] == 499
    assert payload["currency"] == "SAR"
    assert payload["provider_reference"] == transaction_id
    assert calls == [
        {
            "transaction_id": transaction_id,
            "trusted_root_certificates": (b"trusted-test-root",),
            "expected_product_id": "ai.smartexpense.support.small",
            "bundle_id": payment_providers.MOBILE_APP_BUNDLE_ID,
            "expected_app_account_token": user.user_id,
            "environment": "Production",
        }
    ]

    row = (
        await db_connection.execute(
            text(
                """
                select user_id, tier_id, channel, provider_transaction_id,
                       amount_minor_units, currency, status
                from public.support_purchases
                where id = :purchase_id
                """
            ),
            {"purchase_id": payload["id"]},
        )
    ).one()
    assert str(row.user_id) == user.user_id
    assert row.tier_id == "support_small"
    assert row.channel == "ios"
    assert row.provider_transaction_id == transaction_id
    assert row.amount_minor_units == 499
    assert row.currency == "SAR"
    assert row.status == "completed"


async def test_mobile_google_pending_is_reverified_and_duplicate_completion_is_idempotent(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-mobile-google")
    purchase_token = f"google-token-{uuid4().hex}"
    states: list[payment_providers.StorePurchaseState] = ["pending", "completed"]
    calls: list[dict] = []

    async def fake_verify_google_purchase(**kwargs):
        calls.append(kwargs)
        return _verified_google(
            purchase_token=purchase_token,
            user_id=user.user_id,
            state=states.pop(0) if states else "completed",
        )

    monkeypatch.setattr(
        payment_providers,
        "verify_google_purchase",
        fake_verify_google_purchase,
    )

    request = {
        "tier_id": "support_small",
        "channel": "google",
        "provider_transaction_id": purchase_token,
    }
    pending = await api_client.post(
        "/support-purchases/mobile/verify",
        headers=user.auth_header,
        json=request,
    )
    completed = await api_client.post(
        "/support-purchases/mobile/verify",
        headers=user.auth_header,
        json=request,
    )
    replay = await api_client.post(
        "/support-purchases/mobile/verify",
        headers=user.auth_header,
        json=request,
    )

    assert pending.status_code == 200, pending.text
    assert pending.json()["status"] == "pending"
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"
    assert completed.json()["id"] == pending.json()["id"]
    assert completed.json()["provider_reference"] is None
    assert replay.status_code == 200, replay.text
    assert replay.json()["id"] == pending.json()["id"]
    assert replay.json()["status"] == "completed"
    assert len(calls) == 3
    assert calls[0] == {
        "package_name": payment_providers.MOBILE_APP_BUNDLE_ID,
        "purchase_token": purchase_token,
        "expected_product_id": "ai.smartexpense.support.small",
        "expected_app_account_token": user.user_id,
    }

    rows = (
        await db_connection.execute(
            text(
                """
                select id, status
                from public.support_purchases
                where channel = 'android'
                  and provider_transaction_id = :provider_transaction_id
                """
            ),
            {"provider_transaction_id": purchase_token},
        )
    ).all()
    assert len(rows) == 1
    assert rows[0].status == "completed"


@pytest.mark.parametrize(
    ("provider_state", "expected_status"),
    [
        ("failed", "failed"),
        ("cancelled", "failed"),
        ("refunded", "pending"),
        ("revoked", "pending"),
    ],
)
async def test_mobile_verification_maps_provider_terminal_outcomes_forward_only(
    provider_state,
    expected_status,
    api_client,
    signup_user,
    monkeypatch,
) -> None:
    user = await signup_user(f"support-mobile-{provider_state}")
    purchase_token = f"google-token-{uuid4().hex}"

    async def fake_verify_google_purchase(**kwargs):
        return _verified_google(
            purchase_token=purchase_token,
            user_id=user.user_id,
            state=provider_state,
        )

    monkeypatch.setattr(
        payment_providers,
        "verify_google_purchase",
        fake_verify_google_purchase,
    )

    response = await api_client.post(
        "/support-purchases/mobile/verify",
        headers=user.auth_header,
        json={
            "tier_id": "support_small",
            "channel": "google",
            "provider_transaction_id": purchase_token,
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == expected_status
    if expected_status == "failed":
        assert response.json()["failure_reason"] == (
            "store_cancelled"
            if provider_state == "cancelled"
            else "store_failed"
        )


async def test_mobile_verification_rejects_invalid_channel_tier_and_unauthenticated_request(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-mobile-invalid")
    called = False

    async def should_not_verify(**kwargs):
        nonlocal called
        called = True
        raise AssertionError("Invalid mobile requests must not reach a provider.")

    monkeypatch.setattr(
        payment_providers,
        "verify_google_purchase",
        should_not_verify,
    )
    before = (
        await db_connection.execute(
            text("select count(*) from public.support_purchases")
        )
    ).scalar_one()

    unauthenticated = await api_client.post(
        "/support-purchases/mobile/verify",
        json={
            "tier_id": "support_small",
            "channel": "google",
            "provider_transaction_id": "secret-token",
        },
    )
    wrong_channel = await api_client.post(
        "/support-purchases/mobile/verify",
        headers=user.auth_header,
        json={
            "tier_id": "support_small",
            "channel": "android",
            "provider_transaction_id": "secret-token",
        },
    )
    unknown_tier = await api_client.post(
        "/support-purchases/mobile/verify",
        headers=user.auth_header,
        json={
            "tier_id": "custom_amount",
            "channel": "google",
            "provider_transaction_id": "secret-token",
        },
    )
    after = (
        await db_connection.execute(
            text("select count(*) from public.support_purchases")
        )
    ).scalar_one()

    assert unauthenticated.status_code == 401
    assert wrong_channel.status_code == 422
    assert unknown_tier.status_code == 422
    assert unknown_tier.json()["error"]["code"] == "unknown_support_tier"
    assert called is False
    assert after == before


@pytest.mark.parametrize(
    "mismatch",
    [
        "transaction",
        "product",
        "bundle",
        "owner",
        "amount",
        "currency",
    ],
)
async def test_mobile_apple_verification_rejects_every_verified_field_mismatch(
    mismatch,
    api_client,
    signup_user,
    db_connection,
    monkeypatch,
) -> None:
    user = await signup_user(f"support-mobile-mismatch-{mismatch}")
    transaction_id = str(10**15 + int(uuid4().hex[:10], 16))
    verified = _verified_apple(
        transaction_id=transaction_id,
        user_id=user.user_id,
    )
    replacements = {
        "transaction": {"provider_transaction_id": f"{transaction_id}9"},
        "product": {"product_id": "ai.smartexpense.support.large"},
        "bundle": {"bundle_id": "com.example.other"},
        "owner": {"app_account_token": str(uuid4())},
        "amount": {"amount_minor_units": 0},
        "currency": {"currency": "not-a-currency"},
    }
    verified = replace(verified, **replacements[mismatch])

    monkeypatch.setattr(
        payment_providers,
        "load_apple_trusted_root_certificates",
        lambda: (b"trusted-test-root",),
    )

    async def fake_verify_apple_purchase(**kwargs):
        return verified

    monkeypatch.setattr(
        payment_providers,
        "verify_apple_purchase",
        fake_verify_apple_purchase,
    )

    response = await api_client.post(
        "/support-purchases/mobile/verify",
        headers=user.auth_header,
        json={
            "tier_id": "support_small",
            "channel": "apple",
            "provider_transaction_id": transaction_id,
        },
    )

    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "mobile_purchase_mismatch"
    count = (
        await db_connection.execute(
            text(
                """
                select count(*)
                from public.support_purchases
                where channel = 'ios'
                  and provider_transaction_id in (
                    :provider_transaction_id,
                    :verified_transaction_id
                  )
                """
            ),
            {
                "provider_transaction_id": transaction_id,
                "verified_transaction_id": verified.provider_transaction_id,
            },
        )
    ).scalar_one()
    assert count == 0


async def test_mobile_transaction_cannot_be_claimed_by_a_second_user(
    api_client, signup_user, monkeypatch
) -> None:
    owner = await signup_user("support-mobile-owner")
    attacker = await signup_user("support-mobile-attacker")
    purchase_token = f"google-token-{uuid4().hex}"
    calls = 0

    async def fake_verify_google_purchase(**kwargs):
        nonlocal calls
        calls += 1
        return _verified_google(
            purchase_token=purchase_token,
            user_id=owner.user_id,
        )

    monkeypatch.setattr(
        payment_providers,
        "verify_google_purchase",
        fake_verify_google_purchase,
    )
    request = {
        "tier_id": "support_small",
        "channel": "google",
        "provider_transaction_id": purchase_token,
    }

    claimed = await api_client.post(
        "/support-purchases/mobile/verify",
        headers=owner.auth_header,
        json=request,
    )
    stolen = await api_client.post(
        "/support-purchases/mobile/verify",
        headers=attacker.auth_header,
        json=request,
    )

    assert claimed.status_code == 200, claimed.text
    assert stolen.status_code == 409, stolen.text
    assert stolen.json()["error"]["code"] == "mobile_purchase_claimed"
    assert calls == 1


async def test_mobile_purchase_appears_in_same_account_history_and_not_another_users(
    api_client, signup_user, monkeypatch
) -> None:
    owner = await signup_user("support-mobile-history-owner")
    other = await signup_user("support-mobile-history-other")
    transaction_id = str(10**15 + int(uuid4().hex[:10], 16))

    monkeypatch.setattr(
        payment_providers,
        "load_apple_trusted_root_certificates",
        lambda: (b"trusted-test-root",),
    )

    async def fake_verify_apple_purchase(**kwargs):
        return _verified_apple(
            transaction_id=transaction_id,
            user_id=owner.user_id,
        )

    monkeypatch.setattr(
        payment_providers,
        "verify_apple_purchase",
        fake_verify_apple_purchase,
    )
    verified = await api_client.post(
        "/support-purchases/mobile/verify",
        headers=owner.auth_header,
        json={
            "tier_id": "support_small",
            "channel": "apple",
            "provider_transaction_id": transaction_id,
        },
    )
    assert verified.status_code == 200, verified.text

    owner_history = await api_client.get(
        "/support-purchases",
        headers=owner.auth_header,
    )
    other_history = await api_client.get(
        "/support-purchases",
        headers=other.auth_header,
    )

    assert owner_history.status_code == 200, owner_history.text
    assert owner_history.json()["purchases"][0]["id"] == verified.json()["id"]
    assert owner_history.json()["purchases"][0]["channel"] == "ios"
    assert owner_history.json()["purchases"][0]["status"] == "completed"
    assert other_history.status_code == 200, other_history.text
    assert other_history.json() == {"purchases": []}


async def test_mobile_concurrent_verification_of_the_same_transaction_creates_one_row(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    """Two simultaneous /mobile/verify calls for the identical purchase token
    (e.g. a double-tap or a retried request racing the original) must never
    race their way into two rows or two different outcomes."""

    user = await signup_user("support-mobile-concurrent")
    purchase_token = f"google-token-{uuid4().hex}"
    calls = 0

    async def fake_verify_google_purchase(**kwargs):
        nonlocal calls
        calls += 1
        return _verified_google(
            purchase_token=purchase_token,
            user_id=user.user_id,
        )

    monkeypatch.setattr(
        payment_providers, "verify_google_purchase", fake_verify_google_purchase
    )
    request = {
        "tier_id": "support_small",
        "channel": "google",
        "provider_transaction_id": purchase_token,
    }

    first, second = await asyncio.gather(
        api_client.post(
            "/support-purchases/mobile/verify",
            headers=user.auth_header,
            json=request,
        ),
        api_client.post(
            "/support-purchases/mobile/verify",
            headers=user.auth_header,
            json=request,
        ),
    )

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["status"] == "completed"
    assert second.json()["status"] == "completed"

    rows = (
        await db_connection.execute(
            text(
                """
                select count(*) from public.support_purchases
                where channel = 'android' and provider_transaction_id = :token
                """
            ),
            {"token": purchase_token},
        )
    ).scalar_one()
    assert rows == 1
