from __future__ import annotations

import asyncio
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
    monkeypatch.setenv("APPLE_APP_STORE_ENVIRONMENT", "Sandbox")
    monkeypatch.setenv(
        "GOOGLE_PLAY_NOTIFICATION_AUDIENCE",
        "https://api.smartexpense.ai/support-purchases/webhooks/google",
    )
    monkeypatch.setenv(
        "GOOGLE_PLAY_NOTIFICATION_SERVICE_ACCOUNT_EMAIL",
        "play-notifications@example.iam.gserviceaccount.com",
    )
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


async def _purchase_state(
    db_connection, *, channel: str, provider_transaction_id: str
) -> tuple[str, str | None]:
    row = (
        await db_connection.execute(
            text(
                """
                select status, failure_reason
                from public.support_purchases
                where channel = :channel
                  and provider_transaction_id = :provider_transaction_id
                """
            ),
            {
                "channel": channel,
                "provider_transaction_id": provider_transaction_id,
            },
        )
    ).one()
    return row.status, row.failure_reason


def _verified_apple_purchase(
    *,
    transaction_id: str,
    user_id: str,
    state: payment_providers.StorePurchaseState,
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


def _verified_google_purchase(
    *,
    purchase_token: str,
    user_id: str,
    state: payment_providers.StorePurchaseState,
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


async def _mobile_purchase(
    api_client,
    user,
    monkeypatch,
    *,
    channel: str,
    provider_transaction_id: str,
    state: payment_providers.StorePurchaseState,
) -> None:
    if channel == "apple":
        monkeypatch.setattr(
            payment_providers,
            "load_apple_trusted_root_certificates",
            lambda: (b"trusted-test-root",),
        )

        async def verify_apple(**kwargs):
            return _verified_apple_purchase(
                transaction_id=provider_transaction_id,
                user_id=user.user_id,
                state=state,
            )

        monkeypatch.setattr(
            payment_providers, "verify_apple_purchase", verify_apple
        )
    else:

        async def verify_google(**kwargs):
            return _verified_google_purchase(
                purchase_token=provider_transaction_id,
                user_id=user.user_id,
                state=state,
            )

        monkeypatch.setattr(
            payment_providers, "verify_google_purchase", verify_google
        )

    response = await api_client.post(
        "/support-purchases/mobile/verify",
        headers=user.auth_header,
        json={
            "tier_id": "support_small",
            "channel": channel,
            "provider_transaction_id": provider_transaction_id,
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == state


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


async def test_payment_cancellation_resolves_pi_to_cs_before_marking_failed(
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
        "payment_intent.canceled",
        {"id": payment_intent_id, "object": "payment_intent"},
        f"evt_{uuid4().hex}",
    )

    assert response.status_code == 204, response.text
    assert resolved == [payment_intent_id]
    assert await _purchase_state(
        db_connection,
        channel="web",
        provider_transaction_id=checkout_session_id,
    ) == ("failed", "payment_cancelled")


async def test_declined_attempt_keeps_a_retryable_session_pending_until_it_succeeds(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    """A declined attempt is not the Checkout Session's terminal signal.

    Stripe keeps the Session open and retryable after
    ``payment_intent.payment_failed``. Failing the row there would make the
    customer's successful retry an illegal ``failed -> completed`` transition
    and hide a real payment (`contracts/webhooks-and-idempotency.md` rule 4).
    """

    user = await signup_user("support-webhook-declined-retry")
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
    declined = await _post_event(
        api_client,
        "payment_intent.payment_failed",
        {
            "id": payment_intent_id,
            "object": "payment_intent",
            "status": "requires_payment_method",
        },
        f"evt_{uuid4().hex}",
    )

    assert declined.status_code == 204, declined.text
    assert await _purchase_state(
        db_connection,
        channel="web",
        provider_transaction_id=checkout_session_id,
    ) == ("pending", None)
    # A non-actionable event must not spend a live Stripe correlation call.
    assert resolved == []

    retried = await _post_event(
        api_client,
        "checkout.session.completed",
        {
            "id": checkout_session_id,
            "object": "checkout.session",
            "payment_status": "paid",
        },
        f"evt_{uuid4().hex}",
    )

    assert retried.status_code == 204, retried.text
    assert await _purchase_state(
        db_connection,
        channel="web",
        provider_transaction_id=checkout_session_id,
    ) == ("completed", None)


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


async def test_expired_checkout_fails_only_the_original_attempt_and_retry_uses_new_identity(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-webhook-expired")
    expired_session_id = f"cs_test_{uuid4().hex}"
    retry_session_id = f"cs_test_{uuid4().hex}"
    await _pending(api_client, user, expired_session_id, monkeypatch)

    expired = await _post_event(
        api_client,
        "checkout.session.expired",
        {
            "id": expired_session_id,
            "object": "checkout.session",
            "status": "expired",
            "payment_status": "unpaid",
        },
        f"evt_{uuid4().hex}",
    )
    late_completion = await _post_event(
        api_client,
        "checkout.session.completed",
        {
            "id": expired_session_id,
            "object": "checkout.session",
            "payment_status": "paid",
        },
        f"evt_{uuid4().hex}",
    )
    await _pending(api_client, user, retry_session_id, monkeypatch)

    assert expired.status_code == 204, expired.text
    assert late_completion.status_code == 204, late_completion.text
    assert await _purchase_state(
        db_connection,
        channel="web",
        provider_transaction_id=expired_session_id,
    ) == ("failed", "checkout_expired")
    assert await _purchase_state(
        db_connection,
        channel="web",
        provider_transaction_id=retry_session_id,
    ) == ("pending", None)
    assert (
        await db_connection.execute(
            text(
                """
                select count(*)
                from public.support_purchases
                where user_id = :user_id
                  and channel = 'web'
                  and provider_transaction_id in (:expired_id, :retry_id)
                """
            ),
            {
                "user_id": user.user_id,
                "expired_id": expired_session_id,
                "retry_id": retry_session_id,
            },
        )
    ).scalar_one() == 2


async def test_google_verified_cancellation_marks_pending_purchase_failed_safely(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-google-cancelled")
    purchase_token = f"google-token-{uuid4().hex}"
    await _mobile_purchase(
        api_client,
        user,
        monkeypatch,
        channel="google",
        provider_transaction_id=purchase_token,
        state="pending",
    )

    monkeypatch.setattr(
        payment_providers,
        "verify_google_notification",
        lambda *args, **kwargs: payment_providers.VerifiedGoogleNotification(
            message_id="message-cancelled",
            notification_type="ONE_TIME_PRODUCT_CANCELED",
            provider_transaction_id=purchase_token,
            product_id="ai.smartexpense.support.small",
            package_name=payment_providers.MOBILE_APP_BUNDLE_ID,
            is_full_refund=False,
            payload={},
        ),
    )

    async def verify_snapshot(**kwargs):
        return payment_providers.VerifiedGooglePurchaseSnapshot(
            provider_transaction_id=purchase_token,
            product_id="ai.smartexpense.support.small",
            package_name=payment_providers.MOBILE_APP_BUNDLE_ID,
            app_account_token=user.user_id,
            state="cancelled",
            refundable_quantity=1,
            payload={},
        )

    monkeypatch.setattr(
        payment_providers, "verify_google_purchase_snapshot", verify_snapshot
    )
    response = await api_client.post(
        "/support-purchases/webhooks/google",
        headers={"Authorization": "Bearer verified-test-token"},
        json={"message": {"messageId": "message-cancelled", "data": "ignored"}},
    )

    assert response.status_code == 204, response.text
    assert await _purchase_state(
        db_connection,
        channel="android",
        provider_transaction_id=purchase_token,
    ) == ("failed", "store_cancelled")


async def test_apple_has_no_fabricated_failed_one_time_purchase_notification(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-apple-no-failure-signal")
    transaction_id = str(10**15 + int(uuid4().hex[:10], 16))
    await _mobile_purchase(
        api_client,
        user,
        monkeypatch,
        channel="apple",
        provider_transaction_id=transaction_id,
        state="pending",
    )
    monkeypatch.setattr(
        payment_providers,
        "verify_apple_jws_notification",
        lambda *args, **kwargs: payment_providers.VerifiedAppleNotification(
            notification_id="notification-subscription-failure",
            notification_type="DID_FAIL_TO_RENEW",
            provider_transaction_id=transaction_id,
            original_transaction_id=transaction_id,
            product_id="ai.smartexpense.support.small",
            app_account_token=user.user_id,
            payload={},
            transaction={},
        ),
    )

    response = await api_client.post(
        "/support-purchases/webhooks/apple",
        json={"signedPayload": "verified-by-test-double"},
    )

    assert response.status_code == 204, response.text
    assert await _purchase_state(
        db_connection,
        channel="ios",
        provider_transaction_id=transaction_id,
    ) == ("pending", None)


@pytest.mark.parametrize("notification_type", ["REFUND", "REVOKE"])
async def test_verified_apple_refund_or_revocation_correlates_original_id_and_marks_refunded(
    notification_type, api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user(f"support-apple-{notification_type.lower()}")
    stored_transaction_id = str(10**15 + int(uuid4().hex[:10], 16))
    notification_transaction_id = str(int(stored_transaction_id) + 1)
    await _mobile_purchase(
        api_client,
        user,
        monkeypatch,
        channel="apple",
        provider_transaction_id=stored_transaction_id,
        state="completed",
    )
    monkeypatch.setattr(
        payment_providers,
        "verify_apple_jws_notification",
        lambda *args, **kwargs: payment_providers.VerifiedAppleNotification(
            notification_id=f"notification-{notification_type.lower()}",
            notification_type=notification_type,
            provider_transaction_id=notification_transaction_id,
            original_transaction_id=stored_transaction_id,
            product_id="ai.smartexpense.support.small",
            app_account_token=user.user_id,
            payload={},
            transaction={},
        ),
    )

    response = await api_client.post(
        "/support-purchases/webhooks/apple",
        json={"signedPayload": "verified-by-test-double"},
    )

    assert response.status_code == 204, response.text
    assert await _purchase_state(
        db_connection,
        channel="ios",
        provider_transaction_id=stored_transaction_id,
    ) == ("refunded", None)


async def test_verified_google_full_void_marks_refunded_without_catalog_lookup(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-google-refund")
    purchase_token = f"google-token-{uuid4().hex}"
    await _mobile_purchase(
        api_client,
        user,
        monkeypatch,
        channel="google",
        provider_transaction_id=purchase_token,
        state="completed",
    )
    monkeypatch.setattr(
        payment_providers,
        "verify_google_notification",
        lambda *args, **kwargs: payment_providers.VerifiedGoogleNotification(
            message_id="message-refund",
            notification_type="VOIDED_PURCHASE",
            provider_transaction_id=purchase_token,
            product_id=None,
            package_name=payment_providers.MOBILE_APP_BUNDLE_ID,
            is_full_refund=True,
            payload={},
        ),
    )
    calls: list[dict] = []

    async def verify_snapshot(**kwargs):
        calls.append(kwargs)
        return payment_providers.VerifiedGooglePurchaseSnapshot(
            provider_transaction_id=purchase_token,
            product_id="ai.smartexpense.support.small",
            package_name=payment_providers.MOBILE_APP_BUNDLE_ID,
            app_account_token=user.user_id,
            state="cancelled",
            refundable_quantity=None,
            payload={},
        )

    monkeypatch.setattr(
        payment_providers, "verify_google_purchase_snapshot", verify_snapshot
    )
    response = await api_client.post(
        "/support-purchases/webhooks/google",
        headers={"Authorization": "Bearer verified-test-token"},
        json={"message": {"messageId": "message-refund", "data": "ignored"}},
    )

    assert response.status_code == 204, response.text
    assert len(calls) == 1
    assert "expected_product_id" in calls[0]
    assert "expected_app_account_token" in calls[0]
    assert await _purchase_state(
        db_connection,
        channel="android",
        provider_transaction_id=purchase_token,
    ) == ("refunded", None)


async def test_invalid_apple_jws_and_failed_google_auth_cause_no_transition(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-invalid-store-notifications")
    apple_transaction_id = str(10**15 + int(uuid4().hex[:10], 16))
    google_purchase_token = f"google-token-{uuid4().hex}"
    await _mobile_purchase(
        api_client,
        user,
        monkeypatch,
        channel="apple",
        provider_transaction_id=apple_transaction_id,
        state="completed",
    )
    await _mobile_purchase(
        api_client,
        user,
        monkeypatch,
        channel="google",
        provider_transaction_id=google_purchase_token,
        state="completed",
    )
    monkeypatch.setattr(
        payment_providers,
        "load_apple_trusted_root_certificates",
        lambda: (b"trusted-test-root",),
    )

    def reject_apple(*args, **kwargs):
        raise payment_providers.ProviderVerificationError(
            "untrusted signed payload"
        )

    def reject_google(*args, **kwargs):
        raise payment_providers.ProviderVerificationError(
            "failed push identity verification"
        )

    monkeypatch.setattr(
        payment_providers, "verify_apple_jws_notification", reject_apple
    )
    apple = await api_client.post(
        "/support-purchases/webhooks/apple",
        json={"signedPayload": "untrusted-jws-value"},
    )
    monkeypatch.setattr(
        payment_providers, "verify_google_notification", reject_google
    )
    google = await api_client.post(
        "/support-purchases/webhooks/google",
        headers={"Authorization": "Bearer untrusted-value"},
        json={"message": {"messageId": "invalid", "data": "ignored"}},
    )

    assert apple.status_code == 400
    assert apple_transaction_id not in apple.text
    assert "untrusted-jws-value" not in apple.text
    assert google.status_code == 400
    assert google_purchase_token not in google.text
    assert "untrusted-value" not in google.text
    assert await _purchase_state(
        db_connection,
        channel="ios",
        provider_transaction_id=apple_transaction_id,
    ) == ("completed", None)
    assert await _purchase_state(
        db_connection,
        channel="android",
        provider_transaction_id=google_purchase_token,
    ) == ("completed", None)


async def test_store_notifications_reject_ownership_mismatch_and_unknown_transactions(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-store-notification-mismatch")
    transaction_id = str(10**15 + int(uuid4().hex[:10], 16))
    await _mobile_purchase(
        api_client,
        user,
        monkeypatch,
        channel="apple",
        provider_transaction_id=transaction_id,
        state="completed",
    )
    monkeypatch.setattr(
        payment_providers,
        "verify_apple_jws_notification",
        lambda *args, **kwargs: payment_providers.VerifiedAppleNotification(
            notification_id="notification-wrong-owner",
            notification_type="REFUND",
            provider_transaction_id=transaction_id,
            original_transaction_id=transaction_id,
            product_id="ai.smartexpense.support.small",
            app_account_token=str(uuid4()),
            payload={},
            transaction={},
        ),
    )
    rejected_owner = await api_client.post(
        "/support-purchases/webhooks/apple",
        json={"signedPayload": "verified-by-test-double"},
    )

    unknown_token = f"google-token-unknown-{uuid4().hex}"
    monkeypatch.setattr(
        payment_providers,
        "verify_google_notification",
        lambda *args, **kwargs: payment_providers.VerifiedGoogleNotification(
            message_id="message-unknown",
            notification_type="VOIDED_PURCHASE",
            provider_transaction_id=unknown_token,
            product_id=None,
            package_name=payment_providers.MOBILE_APP_BUNDLE_ID,
            is_full_refund=True,
            payload={},
        ),
    )

    async def must_not_verify_unknown(**kwargs):
        raise AssertionError("Unknown transactions must be discarded, not created.")

    monkeypatch.setattr(
        payment_providers,
        "verify_google_purchase_snapshot",
        must_not_verify_unknown,
    )
    before = (
        await db_connection.execute(
            text("select count(*) from public.support_purchases")
        )
    ).scalar_one()
    unknown = await api_client.post(
        "/support-purchases/webhooks/google",
        headers={"Authorization": "Bearer verified-test-token"},
        json={"message": {"messageId": "message-unknown", "data": "ignored"}},
    )
    after = (
        await db_connection.execute(
            text("select count(*) from public.support_purchases")
        )
    ).scalar_one()

    assert rejected_owner.status_code == 204
    assert await _purchase_state(
        db_connection,
        channel="ios",
        provider_transaction_id=transaction_id,
    ) == ("completed", None)
    assert unknown.status_code == 204
    assert after == before


async def test_original_transaction_fallback_still_rejects_an_ownership_mismatch(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    """The fallback resolves a row; it never bypasses the ownership check.

    The exact ``transactionId`` has no row, so the handler falls back to the
    notification's ``originalTransactionId``. That resolved purchase must
    still be proven to belong to the notification's ``appAccountToken``
    before any refund is applied.
    """

    user = await signup_user("support-apple-fallback-mismatch")
    stored_transaction_id = str(10**15 + int(uuid4().hex[:10], 16))
    unrecorded_transaction_id = str(int(stored_transaction_id) + 7)
    await _mobile_purchase(
        api_client,
        user,
        monkeypatch,
        channel="apple",
        provider_transaction_id=stored_transaction_id,
        state="completed",
    )
    monkeypatch.setattr(
        payment_providers,
        "verify_apple_jws_notification",
        lambda *args, **kwargs: payment_providers.VerifiedAppleNotification(
            notification_id="notification-fallback-wrong-owner",
            notification_type="REFUND",
            provider_transaction_id=unrecorded_transaction_id,
            original_transaction_id=stored_transaction_id,
            product_id="ai.smartexpense.support.small",
            app_account_token=str(uuid4()),
            payload={},
            transaction={},
        ),
    )

    response = await api_client.post(
        "/support-purchases/webhooks/apple",
        json={"signedPayload": "verified-by-test-double"},
    )

    assert response.status_code == 204, response.text
    assert await _purchase_state(
        db_connection,
        channel="ios",
        provider_transaction_id=stored_transaction_id,
    ) == ("completed", None)
    assert (
        await db_connection.execute(
            text(
                """
                select count(*)
                from public.support_purchases
                where channel = 'ios'
                  and provider_transaction_id = :unrecorded_id
                """
            ),
            {"unrecorded_id": unrecorded_transaction_id},
        )
    ).scalar_one() == 0


async def test_duplicate_and_concurrent_refund_notifications_are_safe_noops(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-concurrent-refund")
    purchase_token = f"google-token-{uuid4().hex}"
    await _mobile_purchase(
        api_client,
        user,
        monkeypatch,
        channel="google",
        provider_transaction_id=purchase_token,
        state="completed",
    )
    monkeypatch.setattr(
        payment_providers,
        "verify_google_notification",
        lambda *args, **kwargs: payment_providers.VerifiedGoogleNotification(
            message_id="message-refund-redelivery",
            notification_type="VOIDED_PURCHASE",
            provider_transaction_id=purchase_token,
            product_id=None,
            package_name=payment_providers.MOBILE_APP_BUNDLE_ID,
            is_full_refund=True,
            payload={},
        ),
    )

    async def verify_snapshot(**kwargs):
        return payment_providers.VerifiedGooglePurchaseSnapshot(
            provider_transaction_id=purchase_token,
            product_id="ai.smartexpense.support.small",
            package_name=payment_providers.MOBILE_APP_BUNDLE_ID,
            app_account_token=user.user_id,
            state="cancelled",
            refundable_quantity=0,
            payload={},
        )

    monkeypatch.setattr(
        payment_providers, "verify_google_purchase_snapshot", verify_snapshot
    )
    request = {
        "headers": {"Authorization": "Bearer verified-test-token"},
        "json": {"message": {"messageId": "message-refund", "data": "ignored"}},
    }
    first, second = await asyncio.gather(
        api_client.post("/support-purchases/webhooks/google", **request),
        api_client.post("/support-purchases/webhooks/google", **request),
    )
    replay = await api_client.post(
        "/support-purchases/webhooks/google", **request
    )

    assert first.status_code == 204, first.text
    assert second.status_code == 204, second.text
    assert replay.status_code == 204, replay.text
    assert await _purchase_state(
        db_connection,
        channel="android",
        provider_transaction_id=purchase_token,
    ) == ("refunded", None)
    assert (
        await db_connection.execute(
            text(
                """
                select count(*)
                from public.support_purchases
                where channel = 'android'
                  and provider_transaction_id = :purchase_token
                """
            ),
            {"purchase_token": purchase_token},
        )
    ).scalar_one() == 1
