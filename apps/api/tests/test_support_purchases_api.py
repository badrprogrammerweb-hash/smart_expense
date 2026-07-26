from uuid import uuid4

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
