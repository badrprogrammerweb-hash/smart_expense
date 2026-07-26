from __future__ import annotations

import hashlib
import hmac
import json
import time
from uuid import uuid4

import pytest
from sqlalchemy import text

from app.core.config import get_settings
from app.services import payment_providers
from conftest import requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]
WEBHOOK_SECRET = "whsec_phase3_test"


@pytest.fixture(autouse=True)
def _stripe_webhook_settings(monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SIGNING_SECRET", WEBHOOK_SECRET)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _event_payload(event_type: str, provider_object: dict, event_id: str) -> bytes:
    return json.dumps(
        {
            "id": event_id,
            "object": "event",
            "type": event_type,
            "data": {"object": provider_object},
        },
        separators=(",", ":"),
    ).encode()


def _signature(payload: bytes, secret: str = WEBHOOK_SECRET) -> str:
    timestamp = int(time.time())
    digest = hmac.new(
        secret.encode(),
        f"{timestamp}.".encode() + payload,
        hashlib.sha256,
    ).hexdigest()
    return f"t={timestamp},v1={digest}"


async def _post_event(api_client, event_type: str, provider_object: dict, event_id: str):
    payload = _event_payload(event_type, provider_object, event_id)
    return await api_client.post(
        "/support-purchases/webhooks/stripe",
        content=payload,
        headers={
            "Content-Type": "application/json",
            "Stripe-Signature": _signature(payload),
        },
    )


async def _pending(api_client, user, checkout_session_id: str, monkeypatch):
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
    response = await api_client.post(
        "/support-purchases/checkout-sessions",
        headers=user.auth_header,
        json={"tier_id": "support_small", "locale": "en"},
    )
    assert response.status_code == 201, response.text


async def _status(db_connection, checkout_session_id: str) -> str:
    return (
        await db_connection.execute(
            text(
                """
                select status
                from public.support_purchases
                where channel = 'web'
                  and provider_transaction_id = :session_id
                """
            ),
            {"session_id": checkout_session_id},
        )
    ).scalar_one()


async def test_signed_checkout_completion_uses_checkout_session_id_and_is_idempotent(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-webhook-complete")
    checkout_session_id = f"cs_test_{uuid4().hex}"
    payment_intent_id = f"pi_test_{uuid4().hex}"
    await _pending(api_client, user, checkout_session_id, monkeypatch)

    async def must_not_resolve_payment_intent(*args, **kwargs):
        raise AssertionError("Checkout Session events already carry their cs_ id.")

    monkeypatch.setattr(
        payment_providers,
        "resolve_stripe_checkout_session_id",
        must_not_resolve_payment_intent,
    )
    provider_object = {
        "id": checkout_session_id,
        "object": "checkout.session",
        "payment_intent": payment_intent_id,
        "payment_status": "paid",
    }
    first = await _post_event(
        api_client,
        "checkout.session.completed",
        provider_object,
        f"evt_{uuid4().hex}",
    )
    repeated = await _post_event(
        api_client,
        "checkout.session.completed",
        provider_object,
        f"evt_{uuid4().hex}",
    )

    assert first.status_code == 204, first.text
    assert repeated.status_code == 204, repeated.text
    assert await _status(db_connection, checkout_session_id) == "completed"


async def test_invalid_stripe_signature_is_rejected_without_transition(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-webhook-invalid")
    checkout_session_id = f"cs_test_{uuid4().hex}"
    await _pending(api_client, user, checkout_session_id, monkeypatch)
    payload = _event_payload(
        "checkout.session.completed",
        {
            "id": checkout_session_id,
            "object": "checkout.session",
            "payment_status": "paid",
        },
        f"evt_{uuid4().hex}",
    )

    response = await api_client.post(
        "/support-purchases/webhooks/stripe",
        content=payload,
        headers={
            "Content-Type": "application/json",
            "Stripe-Signature": _signature(payload, "whsec_wrong"),
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_stripe_signature"
    assert await _status(db_connection, checkout_session_id) == "pending"


async def test_payment_failure_resolves_pi_to_cs_before_marking_failed(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-webhook-failed")
    checkout_session_id = f"cs_test_{uuid4().hex}"
    payment_intent_id = f"pi_test_{uuid4().hex}"
    await _pending(api_client, user, checkout_session_id, monkeypatch)
    resolved: list[str] = []

    async def resolve(payment_intent: str, **kwargs):
        resolved.append(payment_intent)
        return checkout_session_id

    monkeypatch.setattr(
        payment_providers, "resolve_stripe_checkout_session_id", resolve
    )
    response = await _post_event(
        api_client,
        "payment_intent.payment_failed",
        {"id": payment_intent_id, "object": "payment_intent"},
        f"evt_{uuid4().hex}",
    )

    assert response.status_code == 204, response.text
    assert resolved == [payment_intent_id]
    assert await _status(db_connection, checkout_session_id) == "failed"


async def test_refund_resolves_pi_to_cs_and_handles_out_of_order_and_replay(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-webhook-refund")
    checkout_session_id = f"cs_test_{uuid4().hex}"
    payment_intent_id = f"pi_test_{uuid4().hex}"
    await _pending(api_client, user, checkout_session_id, monkeypatch)
    resolved: list[str] = []

    async def resolve(payment_intent: str, **kwargs):
        resolved.append(payment_intent)
        return checkout_session_id

    monkeypatch.setattr(
        payment_providers, "resolve_stripe_checkout_session_id", resolve
    )
    refund_object = {
        "id": f"ch_test_{uuid4().hex}",
        "object": "charge",
        "payment_intent": payment_intent_id,
        "refunded": True,
    }
    first = await _post_event(
        api_client,
        "charge.refunded",
        refund_object,
        f"evt_{uuid4().hex}",
    )
    replay = await _post_event(
        api_client,
        "charge.refunded",
        refund_object,
        f"evt_{uuid4().hex}",
    )
    late_completion = await _post_event(
        api_client,
        "checkout.session.completed",
        {
            "id": checkout_session_id,
            "object": "checkout.session",
            "payment_intent": payment_intent_id,
            "payment_status": "paid",
        },
        f"evt_{uuid4().hex}",
    )

    assert first.status_code == 204, first.text
    assert replay.status_code == 204, replay.text
    assert late_completion.status_code == 204, late_completion.text
    assert resolved == [payment_intent_id, payment_intent_id]
    assert await _status(db_connection, checkout_session_id) == "refunded"


async def test_unknown_payment_intent_is_acknowledged_without_creating_a_row(
    api_client, db_connection, monkeypatch
) -> None:
    payment_intent_id = f"pi_test_{uuid4().hex}"

    async def resolve(payment_intent: str, **kwargs):
        assert payment_intent == payment_intent_id
        return None

    monkeypatch.setattr(
        payment_providers, "resolve_stripe_checkout_session_id", resolve
    )
    before = (
        await db_connection.execute(text("select count(*) from public.support_purchases"))
    ).scalar_one()

    response = await _post_event(
        api_client,
        "payment_intent.payment_failed",
        {"id": payment_intent_id, "object": "payment_intent"},
        f"evt_{uuid4().hex}",
    )

    after = (
        await db_connection.execute(text("select count(*) from public.support_purchases"))
    ).scalar_one()
    assert response.status_code == 204, response.text
    assert after == before


async def test_transient_correlation_failure_is_retryable_and_leaves_purchase_pending(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    """A Stripe API outage during payment_intent-to-session correlation must
    surface as a retryable 503 — never a silently-acknowledged 204 — so
    Stripe's own webhook retry mechanism delivers the event again later."""

    user = await signup_user("support-webhook-transient")
    checkout_session_id = f"cs_test_{uuid4().hex}"
    payment_intent_id = f"pi_test_{uuid4().hex}"
    await _pending(api_client, user, checkout_session_id, monkeypatch)

    async def failing_resolve(payment_intent: str, **kwargs):
        raise payment_providers.PaymentProviderError("Stripe correlation is down.")

    monkeypatch.setattr(
        payment_providers, "resolve_stripe_checkout_session_id", failing_resolve
    )

    response = await _post_event(
        api_client,
        "payment_intent.succeeded",
        {"id": payment_intent_id, "object": "payment_intent"},
        f"evt_{uuid4().hex}",
    )

    assert response.status_code == 503, response.text
    assert response.json()["error"]["code"] == "stripe_correlation_unavailable"
    assert await _status(db_connection, checkout_session_id) == "pending"


async def test_partial_refund_does_not_mark_the_whole_purchase_refunded(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-webhook-partial-refund")
    checkout_session_id = f"cs_test_{uuid4().hex}"
    payment_intent_id = f"pi_test_{uuid4().hex}"
    await _pending(api_client, user, checkout_session_id, monkeypatch)

    completed = await _post_event(
        api_client,
        "checkout.session.completed",
        {
            "id": checkout_session_id,
            "object": "checkout.session",
            "payment_intent": payment_intent_id,
            "payment_status": "paid",
        },
        f"evt_{uuid4().hex}",
    )
    assert completed.status_code == 204

    async def resolve(payment_intent: str, **kwargs):
        assert payment_intent == payment_intent_id
        return checkout_session_id

    monkeypatch.setattr(
        payment_providers, "resolve_stripe_checkout_session_id", resolve
    )
    partial_refund = await _post_event(
        api_client,
        "charge.refunded",
        {
            "id": f"ch_test_{uuid4().hex}",
            "object": "charge",
            "payment_intent": payment_intent_id,
            "refunded": False,
        },
        f"evt_{uuid4().hex}",
    )

    assert partial_refund.status_code == 204
    assert await _status(db_connection, checkout_session_id) == "completed"
