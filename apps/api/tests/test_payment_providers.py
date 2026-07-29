"""Provider-verification tests: Stripe webhooks, Apple JWS, Google Pub/Sub.

These exercise the pure verification/normalization logic in
`app.services.payment_providers` without any network access — Stripe's HMAC
scheme, Apple's x5c certificate chain, and Google's OIDC-signed Pub/Sub push
are all reproduced locally with test keys, matching each provider's real
verification algorithm rather than a stand-in.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone

import jwt
import pytest
import stripe
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat
from cryptography.x509.oid import NameOID

from app.services import payment_providers as pp


# ---------------------------------------------------------------------------
# Stripe: raw-body signature verification + identifier extraction
# ---------------------------------------------------------------------------


def _stripe_signature_header(payload: bytes, secret: str, *, timestamp: int | None = None) -> str:
    ts = timestamp if timestamp is not None else int(time.time())
    signed_payload = f"{ts}.{payload.decode('utf-8')}"
    signature = hmac.new(secret.encode("utf-8"), signed_payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"t={ts},v1={signature}"


def _stripe_event_payload(*, event_type: str, obj: dict, event_id: str = "evt_test_1") -> bytes:
    body = {
        "id": event_id,
        "object": "event",
        "type": event_type,
        "data": {"object": obj},
    }
    return json.dumps(body).encode("utf-8")


def test_verify_stripe_webhook_accepts_valid_signature_and_extracts_session_id() -> None:
    secret = "whsec_test_secret"
    payload = _stripe_event_payload(
        event_type="checkout.session.completed",
        obj={"id": "cs_test_123", "payment_intent": "pi_test_123", "object": "checkout.session"},
    )
    header = _stripe_signature_header(payload, secret)

    event = pp.verify_stripe_webhook(payload, header, webhook_secret=secret)

    assert event.event_type == "checkout.session.completed"
    assert event.provider_transaction_id == "cs_test_123"
    assert event.payment_intent_id == "pi_test_123"


def test_verify_stripe_webhook_rejects_invalid_signature() -> None:
    secret = "whsec_test_secret"
    payload = _stripe_event_payload(
        event_type="checkout.session.completed",
        obj={"id": "cs_test_123", "object": "checkout.session"},
    )
    bad_header = _stripe_signature_header(payload, "whsec_wrong_secret")

    with pytest.raises(pp.ProviderVerificationError):
        pp.verify_stripe_webhook(payload, bad_header, webhook_secret=secret)


def test_verify_stripe_webhook_rejects_a_reserialized_payload() -> None:
    """The signature must be computed over the exact raw body, not any
    semantically-equivalent re-encoding of it (e.g. reordered/reformatted
    JSON) — proving the raw-body requirement is actually enforced."""

    secret = "whsec_test_secret"
    original = _stripe_event_payload(
        event_type="checkout.session.completed",
        obj={"id": "cs_test_123", "object": "checkout.session"},
    )
    header = _stripe_signature_header(original, secret)

    reserialized = json.dumps(json.loads(original), indent=2).encode("utf-8")
    assert reserialized != original

    with pytest.raises(pp.ProviderVerificationError):
        pp.verify_stripe_webhook(reserialized, header, webhook_secret=secret)


def test_verify_stripe_webhook_rejects_stale_timestamp() -> None:
    secret = "whsec_test_secret"
    payload = _stripe_event_payload(
        event_type="checkout.session.completed",
        obj={"id": "cs_test_123", "object": "checkout.session"},
    )
    stale_header = _stripe_signature_header(
        payload, secret, timestamp=int(time.time()) - 3600
    )

    with pytest.raises(pp.ProviderVerificationError):
        pp.verify_stripe_webhook(
            payload, stale_header, webhook_secret=secret, tolerance_seconds=300
        )


@pytest.mark.parametrize(
    "event_type,obj",
    [
        ("payment_intent.succeeded", {"id": "pi_test_999", "object": "payment_intent"}),
        (
            "charge.refunded",
            {"id": "ch_test_999", "object": "charge", "payment_intent": "pi_test_999"},
        ),
        (
            "refund.updated",
            {"id": "re_test_999", "object": "refund", "payment_intent": "pi_test_999"},
        ),
    ],
)
def test_verify_stripe_webhook_never_reports_a_payment_intent_as_a_checkout_session_id(
    event_type: str, obj: dict
) -> None:
    """Invariant: an event whose object is not a Checkout Session must never
    yield a `provider_transaction_id` — `create_pending` only ever stores
    Checkout Session ids, so surfacing a PaymentIntent/Charge/Refund id under
    that field would let a caller silently look up the wrong row (or none)."""

    secret = "whsec_test_secret"
    payload = _stripe_event_payload(event_type=event_type, obj=obj)
    header = _stripe_signature_header(payload, secret)

    event = pp.verify_stripe_webhook(payload, header, webhook_secret=secret)

    assert event.provider_transaction_id is None
    assert event.payment_intent_id == "pi_test_999"


def test_verify_stripe_webhook_rejects_event_with_no_identifier() -> None:
    secret = "whsec_test_secret"
    payload = _stripe_event_payload(event_type="charge.refunded", obj={"object": "charge"})
    header = _stripe_signature_header(payload, secret)

    with pytest.raises(pp.ProviderVerificationError):
        pp.verify_stripe_webhook(payload, header, webhook_secret=secret)


@pytest.mark.asyncio
async def test_create_stripe_checkout_session_uses_one_time_payment_mode(monkeypatch) -> None:
    captured: dict = {}

    class _FakeSessionsResource:
        def create(self, params, options):
            captured["params"] = params
            captured["options"] = options

            class _Session:
                id = "cs_test_created"
                url = "https://checkout.stripe.com/test"
                amount_total = 500
                currency = "sar"

            return _Session()

    class _FakeV1:
        checkout = type("_Checkout", (), {"sessions": _FakeSessionsResource()})()

    class _FakeStripeClient:
        def __init__(self, key):
            captured["key"] = key
            self.v1 = _FakeV1()

    monkeypatch.setattr(pp.stripe, "StripeClient", _FakeStripeClient)

    result = await pp.create_stripe_checkout_session(
        price_id="price_support_small",
        success_url="https://app.example.com/settings/support/result?ok=1",
        cancel_url="https://app.example.com/settings/support/result?cancelled=1",
        user_id="user-123",
        tier_id="support_small",
        idempotency_key="idem-key-1",
        secret_key="sk_test_abc",
    )

    assert result.id == "cs_test_created"
    assert result.amount_minor_units == 500
    assert result.currency == "SAR"
    assert captured["params"]["mode"] == "payment"
    assert captured["options"] == {"idempotency_key": "idem-key-1"}
    assert captured["key"] == "sk_test_abc"


@pytest.mark.asyncio
async def test_resolve_stripe_payment_intent_uses_filtered_checkout_session_lookup(
    monkeypatch,
) -> None:
    captured: dict = {}

    class _FakeSessionsResource:
        def list(self, params):
            captured["params"] = params
            return type(
                "_SessionList",
                (),
                {"data": [type("_Session", (), {"id": "cs_test_correlated"})()]},
            )()

    class _FakeV1:
        checkout = type("_Checkout", (), {"sessions": _FakeSessionsResource()})()

    class _FakeStripeClient:
        def __init__(self, key):
            captured["key"] = key
            self.v1 = _FakeV1()

    monkeypatch.setattr(pp.stripe, "StripeClient", _FakeStripeClient)

    checkout_session_id = await pp.resolve_stripe_checkout_session_id(
        "pi_test_correlated", secret_key="sk_test_abc"
    )

    assert checkout_session_id == "cs_test_correlated"
    assert captured["params"] == {
        "payment_intent": "pi_test_correlated",
        "limit": 2,
    }
    assert captured["key"] == "sk_test_abc"


@pytest.mark.asyncio
async def test_resolve_stripe_payment_intent_never_accepts_a_non_pi_identifier() -> None:
    with pytest.raises(pp.ProviderVerificationError):
        await pp.resolve_stripe_checkout_session_id(
            "cs_test_wrong_space", secret_key="sk_test_abc"
        )


@pytest.mark.asyncio
async def test_resolve_stripe_payment_intent_returns_none_when_no_session_found(
    monkeypatch,
) -> None:
    class _FakeSessionsResource:
        def list(self, params):
            return type("_SessionList", (), {"data": []})()

    class _FakeV1:
        checkout = type("_Checkout", (), {"sessions": _FakeSessionsResource()})()

    class _FakeStripeClient:
        def __init__(self, key):
            self.v1 = _FakeV1()

    monkeypatch.setattr(pp.stripe, "StripeClient", _FakeStripeClient)

    result = await pp.resolve_stripe_checkout_session_id(
        "pi_test_no_match", secret_key="sk_test_abc"
    )

    assert result is None


@pytest.mark.asyncio
async def test_resolve_stripe_payment_intent_rejects_an_ambiguous_correlation(
    monkeypatch,
) -> None:
    class _FakeSessionsResource:
        def list(self, params):
            return type(
                "_SessionList",
                (),
                {
                    "data": [
                        type("_Session", (), {"id": "cs_test_one"})(),
                        type("_Session", (), {"id": "cs_test_two"})(),
                    ]
                },
            )()

    class _FakeV1:
        checkout = type("_Checkout", (), {"sessions": _FakeSessionsResource()})()

    class _FakeStripeClient:
        def __init__(self, key):
            self.v1 = _FakeV1()

    monkeypatch.setattr(pp.stripe, "StripeClient", _FakeStripeClient)

    with pytest.raises(pp.ProviderVerificationError):
        await pp.resolve_stripe_checkout_session_id(
            "pi_test_ambiguous", secret_key="sk_test_abc"
        )


@pytest.mark.asyncio
async def test_resolve_stripe_payment_intent_rejects_a_malformed_returned_id(
    monkeypatch,
) -> None:
    class _FakeSessionsResource:
        def list(self, params):
            return type(
                "_SessionList",
                (),
                {"data": [type("_Session", (), {"id": "not-a-session-id"})()]},
            )()

    class _FakeV1:
        checkout = type("_Checkout", (), {"sessions": _FakeSessionsResource()})()

    class _FakeStripeClient:
        def __init__(self, key):
            self.v1 = _FakeV1()

    monkeypatch.setattr(pp.stripe, "StripeClient", _FakeStripeClient)

    with pytest.raises(pp.ProviderVerificationError):
        await pp.resolve_stripe_checkout_session_id(
            "pi_test_malformed", secret_key="sk_test_abc"
        )


@pytest.mark.asyncio
async def test_resolve_stripe_payment_intent_wraps_a_transient_stripe_error(
    monkeypatch,
) -> None:
    class _FakeSessionsResource:
        def list(self, params):
            raise pp.stripe.APIConnectionError("boom")

    class _FakeV1:
        checkout = type("_Checkout", (), {"sessions": _FakeSessionsResource()})()

    class _FakeStripeClient:
        def __init__(self, key):
            self.v1 = _FakeV1()

    monkeypatch.setattr(pp.stripe, "StripeClient", _FakeStripeClient)

    with pytest.raises(pp.PaymentProviderError):
        await pp.resolve_stripe_checkout_session_id(
            "pi_test_transient_failure", secret_key="sk_test_abc"
        )


@pytest.mark.asyncio
async def test_create_stripe_checkout_session_wraps_stripe_errors(monkeypatch) -> None:
    class _FakeSessionsResource:
        def create(self, params, options):
            raise stripe.APIConnectionError("boom")

    class _FakeV1:
        checkout = type("_Checkout", (), {"sessions": _FakeSessionsResource()})()

    class _FakeStripeClient:
        def __init__(self, key):
            self.v1 = _FakeV1()

    monkeypatch.setattr(pp.stripe, "StripeClient", _FakeStripeClient)

    with pytest.raises(pp.PaymentProviderError):
        await pp.create_stripe_checkout_session(
            price_id="price_support_small",
            success_url="https://app.example.com/ok",
            cancel_url="https://app.example.com/cancel",
            user_id="user-123",
            tier_id="support_small",
            idempotency_key="idem-key-2",
            secret_key="sk_test_abc",
        )


# ---------------------------------------------------------------------------
# Apple: JWS + x5c certificate-chain verification
# ---------------------------------------------------------------------------


def _build_apple_chain():
    root_key = ec.generate_private_key(ec.SECP256R1())
    intermediate_key = ec.generate_private_key(ec.SECP256R1())
    leaf_key = ec.generate_private_key(ec.SECP256R1())

    now = datetime.now(timezone.utc)

    def _name(cn: str) -> x509.Name:
        return x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])

    root_cert = (
        x509.CertificateBuilder()
        .subject_name(_name("Test Apple Root"))
        .issuer_name(_name("Test Apple Root"))
        .public_key(root_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=3650))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(root_key, hashes.SHA256())
    )

    intermediate_cert = (
        x509.CertificateBuilder()
        .subject_name(_name("Test Apple Intermediate"))
        .issuer_name(root_cert.subject)
        .public_key(intermediate_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=3650))
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .add_extension(
            x509.UnrecognizedExtension(pp._APPLE_INTERMEDIATE_OID, b"\x05\x00"),
            critical=False,
        )
        .sign(root_key, hashes.SHA256())
    )

    leaf_cert = (
        x509.CertificateBuilder()
        .subject_name(_name("Test Apple Leaf"))
        .issuer_name(intermediate_cert.subject)
        .public_key(leaf_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=3650))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.UnrecognizedExtension(pp._APPLE_LEAF_OID, b"\x05\x00"),
            critical=False,
        )
        .sign(intermediate_key, hashes.SHA256())
    )

    return {
        "root_cert": root_cert,
        "intermediate_cert": intermediate_cert,
        "leaf_cert": leaf_cert,
        "leaf_key": leaf_key,
    }


def _apple_x5c_header(chain: dict) -> list[str]:
    return [
        base64.b64encode(cert.public_bytes(Encoding.DER)).decode("ascii")
        for cert in (chain["leaf_cert"], chain["intermediate_cert"], chain["root_cert"])
    ]


def _sign_apple_jws(chain: dict, payload: dict) -> str:
    return jwt.encode(
        payload,
        chain["leaf_key"],
        algorithm="ES256",
        headers={"x5c": _apple_x5c_header(chain)},
    )


def test_verify_apple_signed_transaction_accepts_trusted_chain() -> None:
    chain = _build_apple_chain()
    trusted_roots = [chain["root_cert"].public_bytes(Encoding.DER)]
    signed_date_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    token = _sign_apple_jws(
        chain,
        {
            "bundleId": pp.MOBILE_APP_BUNDLE_ID,
            "environment": "Sandbox",
            "transactionId": "1000000000000099",
            "originalTransactionId": "1000000000000001",
            "productId": "ai.smartexpense.support.small",
            "appAccountToken": "c77bdcda-f90d-4b35-a3b1-55fca872e741",
            "price": 4990,
            "currency": "SAR",
            "inAppOwnershipType": "PURCHASED",
            "signedDate": signed_date_ms,
        },
    )

    transaction = pp.verify_apple_signed_transaction(
        token, trusted_root_certificates=trusted_roots, environment="Sandbox"
    )

    assert transaction.provider_transaction_id == "1000000000000099"
    assert transaction.original_transaction_id == "1000000000000001"
    assert transaction.product_id == "ai.smartexpense.support.small"
    assert transaction.bundle_id == pp.MOBILE_APP_BUNDLE_ID
    assert transaction.app_account_token == "c77bdcda-f90d-4b35-a3b1-55fca872e741"
    assert transaction.amount_minor_units == 499
    assert transaction.currency == "SAR"
    assert transaction.state == "completed"


def test_verify_apple_signed_transaction_reports_refunded_state() -> None:
    chain = _build_apple_chain()
    trusted_roots = [chain["root_cert"].public_bytes(Encoding.DER)]
    signed_date_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    token = _sign_apple_jws(
        chain,
        {
            "bundleId": pp.MOBILE_APP_BUNDLE_ID,
            "environment": "Sandbox",
            "originalTransactionId": "1000000000000002",
            "productId": "ai.smartexpense.support.small",
            "signedDate": signed_date_ms,
            "revocationDate": signed_date_ms,
        },
    )

    transaction = pp.verify_apple_signed_transaction(
        token, trusted_root_certificates=trusted_roots, environment="Sandbox"
    )

    assert transaction.state == "refunded"


def test_verify_apple_signed_transaction_rejects_untrusted_root() -> None:
    chain = _build_apple_chain()
    other_chain = _build_apple_chain()
    untrusted_roots = [other_chain["root_cert"].public_bytes(Encoding.DER)]
    token = _sign_apple_jws(
        chain,
        {
            "bundleId": pp.MOBILE_APP_BUNDLE_ID,
            "environment": "Sandbox",
            "originalTransactionId": "1000000000000003",
            "productId": "ai.smartexpense.support.small",
            "signedDate": int(datetime.now(timezone.utc).timestamp() * 1000),
        },
    )

    with pytest.raises(pp.ProviderVerificationError):
        pp.verify_apple_signed_transaction(
            token, trusted_root_certificates=untrusted_roots, environment="Sandbox"
        )


def test_verify_apple_signed_transaction_rejects_expired_certificate() -> None:
    chain = _build_apple_chain()
    trusted_roots = [chain["root_cert"].public_bytes(Encoding.DER)]
    token = _sign_apple_jws(
        chain,
        {
            "bundleId": pp.MOBILE_APP_BUNDLE_ID,
            "environment": "Sandbox",
            "originalTransactionId": "1000000000000004",
            "productId": "ai.smartexpense.support.small",
            "signedDate": int(datetime.now(timezone.utc).timestamp() * 1000),
        },
    )
    far_future = datetime.now(timezone.utc) + timedelta(days=3651)

    with pytest.raises(pp.ProviderVerificationError):
        pp.verify_apple_signed_transaction(
            token,
            trusted_root_certificates=trusted_roots,
            environment="Sandbox",
            effective_time=far_future,
        )


def test_verify_apple_signed_transaction_rejects_wrong_bundle_id() -> None:
    chain = _build_apple_chain()
    trusted_roots = [chain["root_cert"].public_bytes(Encoding.DER)]
    token = _sign_apple_jws(
        chain,
        {
            "bundleId": "com.example.someone-elses-app",
            "environment": "Sandbox",
            "originalTransactionId": "1000000000000005",
            "productId": "ai.smartexpense.support.small",
            "signedDate": int(datetime.now(timezone.utc).timestamp() * 1000),
        },
    )

    with pytest.raises(pp.ProviderVerificationError):
        pp.verify_apple_signed_transaction(
            token, trusted_root_certificates=trusted_roots, environment="Sandbox"
        )


def test_verify_apple_signed_transaction_rejects_malformed_token() -> None:
    chain = _build_apple_chain()
    trusted_roots = [chain["root_cert"].public_bytes(Encoding.DER)]

    with pytest.raises(pp.ProviderVerificationError):
        pp.verify_apple_signed_transaction(
            "not-a-jws-token", trusted_root_certificates=trusted_roots
        )


def test_verify_apple_signed_transaction_rejects_wrong_algorithm() -> None:
    chain = _build_apple_chain()
    trusted_roots = [chain["root_cert"].public_bytes(Encoding.DER)]
    # HS256 with an arbitrary secret — a downgrade attempt away from ES256.
    token = jwt.encode(
        {"bundleId": pp.MOBILE_APP_BUNDLE_ID},
        "some-secret",
        algorithm="HS256",
        headers={"x5c": _apple_x5c_header(chain)},
    )

    with pytest.raises(pp.ProviderVerificationError):
        pp.verify_apple_signed_transaction(token, trusted_root_certificates=trusted_roots)


def test_verify_apple_signed_transaction_requires_a_trusted_root_configured() -> None:
    chain = _build_apple_chain()
    token = _sign_apple_jws(
        chain,
        {
            "bundleId": pp.MOBILE_APP_BUNDLE_ID,
            "originalTransactionId": "1000000000000006",
            "productId": "ai.smartexpense.support.small",
        },
    )

    with pytest.raises(pp.ProviderConfigurationError):
        pp.verify_apple_signed_transaction(token, trusted_root_certificates=[])


def test_verify_apple_refund_notification_keeps_transaction_identifiers_separate() -> None:
    chain = _build_apple_chain()
    trusted_roots = [chain["root_cert"].public_bytes(Encoding.DER)]
    signed_date_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    transaction_id = "1000000000000199"
    original_transaction_id = "1000000000000100"
    account_id = "c77bdcda-f90d-4b35-a3b1-55fca872e741"
    signed_transaction = _sign_apple_jws(
        chain,
        {
            "bundleId": pp.MOBILE_APP_BUNDLE_ID,
            "environment": "Sandbox",
            "transactionId": transaction_id,
            "originalTransactionId": original_transaction_id,
            "productId": "ai.smartexpense.support.small",
            "appAccountToken": account_id,
            "inAppOwnershipType": "PURCHASED",
            "revocationDate": signed_date_ms,
            "signedDate": signed_date_ms,
        },
    )
    signed_notification = _sign_apple_jws(
        chain,
        {
            "notificationUUID": "notification-refund-1",
            "notificationType": "REFUND",
            "signedDate": signed_date_ms,
            "data": {
                "bundleId": pp.MOBILE_APP_BUNDLE_ID,
                "environment": "Sandbox",
                "signedTransactionInfo": signed_transaction,
            },
        },
    )

    notification = pp.verify_apple_jws_notification(
        signed_notification,
        trusted_root_certificates=trusted_roots,
        environment="Sandbox",
    )

    assert notification.notification_type == "REFUND"
    assert notification.transaction_id == transaction_id
    assert notification.original_transaction_id == original_transaction_id
    assert notification.transaction_id != notification.original_transaction_id
    assert notification.app_account_token == account_id
    assert notification.product_id == "ai.smartexpense.support.small"


def test_verify_apple_notification_rejects_an_untrusted_inner_transaction() -> None:
    outer_chain = _build_apple_chain()
    inner_chain = _build_apple_chain()
    trusted_roots = [outer_chain["root_cert"].public_bytes(Encoding.DER)]
    signed_date_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    signed_transaction = _sign_apple_jws(
        inner_chain,
        {
            "bundleId": pp.MOBILE_APP_BUNDLE_ID,
            "environment": "Sandbox",
            "transactionId": "1000000000000200",
            "originalTransactionId": "1000000000000200",
            "productId": "ai.smartexpense.support.small",
            "signedDate": signed_date_ms,
        },
    )
    signed_notification = _sign_apple_jws(
        outer_chain,
        {
            "notificationUUID": "notification-untrusted-inner",
            "notificationType": "REFUND",
            "signedDate": signed_date_ms,
            "data": {
                "bundleId": pp.MOBILE_APP_BUNDLE_ID,
                "environment": "Sandbox",
                "signedTransactionInfo": signed_transaction,
            },
        },
    )

    with pytest.raises(pp.ProviderVerificationError, match="untrusted"):
        pp.verify_apple_jws_notification(
            signed_notification,
            trusted_root_certificates=trusted_roots,
            environment="Sandbox",
        )


# ---------------------------------------------------------------------------
# Google: Pub/Sub OIDC push authentication + notification normalization
# ---------------------------------------------------------------------------


class _FakeSigningKey:
    def __init__(self, key):
        self.key = key


class _FakeJwkClient:
    def __init__(self, key):
        self._key = key

    def get_signing_key_from_jwt(self, token):
        return _FakeSigningKey(self._key)


def _google_oidc_token(
    private_key,
    *,
    audience: str,
    email: str,
    email_verified: bool = True,
    issuer: str = "https://accounts.google.com",
) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "iss": issuer,
            "aud": audience,
            "email": email,
            "email_verified": email_verified,
            "iat": now,
            "exp": now + 300,
        },
        private_key,
        algorithm="RS256",
    )


def _pubsub_envelope(notification: dict) -> dict:
    notification.setdefault("packageName", pp.MOBILE_APP_BUNDLE_ID)
    encoded = base64.b64encode(json.dumps(notification).encode("utf-8")).decode("ascii")
    return {"message": {"messageId": "msg-1", "data": encoded}}


def test_verify_google_notification_accepts_valid_one_time_product_push() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = _google_oidc_token(
        private_key,
        audience="https://api.smartexpense.ai/support-purchases/webhooks/google",
        email="play-notifications@example.iam.gserviceaccount.com",
    )
    envelope = _pubsub_envelope(
        {
            "oneTimeProductNotification": {
                "purchaseToken": "token-abc",
                "sku": "ai.smartexpense.support.small",
                "notificationType": 2,
            }
        }
    )

    notification = pp.verify_google_notification(
        envelope,
        f"Bearer {token}",
        expected_audience="https://api.smartexpense.ai/support-purchases/webhooks/google",
        expected_service_account_email="play-notifications@example.iam.gserviceaccount.com",
        expected_package_name=pp.MOBILE_APP_BUNDLE_ID,
        jwk_client=_FakeJwkClient(private_key.public_key()),
    )

    assert notification.provider_transaction_id == "token-abc"
    assert notification.product_id == "ai.smartexpense.support.small"
    assert notification.notification_type == "ONE_TIME_PRODUCT_CANCELED"


def test_verify_google_notification_accepts_voided_purchase_push() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = _google_oidc_token(
        private_key,
        audience="https://api.smartexpense.ai/support-purchases/webhooks/google",
        email="play-notifications@example.iam.gserviceaccount.com",
    )
    envelope = _pubsub_envelope(
        {
            "voidedPurchaseNotification": {
                "purchaseToken": "token-voided",
                "productType": 2,
                "refundType": 1,
            }
        }
    )

    notification = pp.verify_google_notification(
        envelope,
        f"Bearer {token}",
        expected_audience="https://api.smartexpense.ai/support-purchases/webhooks/google",
        expected_service_account_email="play-notifications@example.iam.gserviceaccount.com",
        expected_package_name=pp.MOBILE_APP_BUNDLE_ID,
        jwk_client=_FakeJwkClient(private_key.public_key()),
    )

    assert notification.notification_type == "VOIDED_PURCHASE"
    assert notification.provider_transaction_id == "token-voided"
    assert notification.package_name == pp.MOBILE_APP_BUNDLE_ID
    assert notification.is_full_refund is True


def test_verify_google_notification_reports_partial_void_without_authorizing_full_refund() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = _google_oidc_token(
        private_key,
        audience="https://api.smartexpense.ai/support-purchases/webhooks/google",
        email="play-notifications@example.iam.gserviceaccount.com",
    )
    envelope = _pubsub_envelope(
        {
            "voidedPurchaseNotification": {
                "purchaseToken": "token-partial",
                "productType": 2,
                "refundType": 2,
            }
        }
    )

    notification = pp.verify_google_notification(
        envelope,
        f"Bearer {token}",
        expected_audience="https://api.smartexpense.ai/support-purchases/webhooks/google",
        expected_service_account_email="play-notifications@example.iam.gserviceaccount.com",
        expected_package_name=pp.MOBILE_APP_BUNDLE_ID,
        jwk_client=_FakeJwkClient(private_key.public_key()),
    )

    assert notification.notification_type == "VOIDED_PURCHASE"
    assert notification.is_full_refund is False


def test_verify_google_notification_rejects_wrong_audience() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = _google_oidc_token(
        private_key,
        audience="https://attacker.example.com/webhook",
        email="play-notifications@example.iam.gserviceaccount.com",
    )
    envelope = _pubsub_envelope(
        {"oneTimeProductNotification": {"purchaseToken": "token-abc", "sku": "x", "notificationType": 1}}
    )

    with pytest.raises(pp.ProviderVerificationError):
        pp.verify_google_notification(
            envelope,
            f"Bearer {token}",
            expected_audience="https://api.smartexpense.ai/support-purchases/webhooks/google",
            expected_service_account_email="play-notifications@example.iam.gserviceaccount.com",
            expected_package_name=pp.MOBILE_APP_BUNDLE_ID,
            jwk_client=_FakeJwkClient(private_key.public_key()),
        )


def test_verify_google_notification_rejects_unexpected_sender_email() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = _google_oidc_token(
        private_key,
        audience="https://api.smartexpense.ai/support-purchases/webhooks/google",
        email="attacker@example.iam.gserviceaccount.com",
    )
    envelope = _pubsub_envelope(
        {"oneTimeProductNotification": {"purchaseToken": "token-abc", "sku": "x", "notificationType": 1}}
    )

    with pytest.raises(pp.ProviderVerificationError):
        pp.verify_google_notification(
            envelope,
            f"Bearer {token}",
            expected_audience="https://api.smartexpense.ai/support-purchases/webhooks/google",
            expected_service_account_email="play-notifications@example.iam.gserviceaccount.com",
            expected_package_name=pp.MOBILE_APP_BUNDLE_ID,
            jwk_client=_FakeJwkClient(private_key.public_key()),
        )


def test_verify_google_notification_rejects_unverified_email() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = _google_oidc_token(
        private_key,
        audience="https://api.smartexpense.ai/support-purchases/webhooks/google",
        email="play-notifications@example.iam.gserviceaccount.com",
        email_verified=False,
    )
    envelope = _pubsub_envelope(
        {"oneTimeProductNotification": {"purchaseToken": "token-abc", "sku": "x", "notificationType": 1}}
    )

    with pytest.raises(pp.ProviderVerificationError):
        pp.verify_google_notification(
            envelope,
            f"Bearer {token}",
            expected_audience="https://api.smartexpense.ai/support-purchases/webhooks/google",
            expected_service_account_email="play-notifications@example.iam.gserviceaccount.com",
            expected_package_name=pp.MOBILE_APP_BUNDLE_ID,
            jwk_client=_FakeJwkClient(private_key.public_key()),
        )


def test_verify_google_notification_rejects_malformed_authorization_header() -> None:
    with pytest.raises(pp.ProviderVerificationError):
        pp.verify_google_notification(
            {"message": {"messageId": "1", "data": "abc"}},
            "NotBearer sometoken",
            expected_audience="aud",
            expected_service_account_email="svc@example.com",
            expected_package_name=pp.MOBILE_APP_BUNDLE_ID,
        )


def test_verify_google_notification_rejects_malformed_message_data() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = _google_oidc_token(
        private_key,
        audience="https://api.smartexpense.ai/support-purchases/webhooks/google",
        email="play-notifications@example.iam.gserviceaccount.com",
    )
    envelope = {"message": {"messageId": "1", "data": "not-valid-base64!!"}}

    with pytest.raises(pp.ProviderVerificationError):
        pp.verify_google_notification(
            envelope,
            f"Bearer {token}",
            expected_audience="https://api.smartexpense.ai/support-purchases/webhooks/google",
            expected_service_account_email="play-notifications@example.iam.gserviceaccount.com",
            expected_package_name=pp.MOBILE_APP_BUNDLE_ID,
            jwk_client=_FakeJwkClient(private_key.public_key()),
        )


# ---------------------------------------------------------------------------
# Google Play purchase verification: state mapping + failure handling
# ---------------------------------------------------------------------------


class _FakeGoogleHttpClient:
    def __init__(
        self,
        token_response: dict,
        purchase_response: dict,
        purchase_status: int = 200,
        product_response: dict | None = None,
        product_status: int = 200,
    ):
        self._token_response = token_response
        self._purchase_response = purchase_response
        self._purchase_status = purchase_status
        self._product_response = product_response
        self._product_status = product_status
        self.requests: list[str] = []

    async def post(self, url, *, data=None, headers=None):
        self.requests.append(url)
        return _FakeHttpResponse(200, self._token_response)

    async def get(self, url, *, headers=None):
        self.requests.append(url)
        if "/oneTimeProducts/" in url:
            return _FakeHttpResponse(
                self._product_status,
                self._product_response or {},
            )
        return _FakeHttpResponse(self._purchase_status, self._purchase_response)


class _FakeHttpResponse:
    def __init__(self, status_code: int, body: dict):
        self.status_code = status_code
        self._body = body

    def raise_for_status(self):
        if self.status_code >= 400:
            import httpx

            raise httpx.HTTPStatusError("error", request=None, response=self)

    def json(self):
        return self._body


def _service_account_json(private_key) -> str:
    pem = private_key.private_bytes(
        encoding=Encoding.PEM,
        format=PrivateFormat.PKCS8,
        encryption_algorithm=NoEncryption(),
    ).decode("utf-8")
    return json.dumps(
        {
            "client_email": "play-billing@example.iam.gserviceaccount.com",
            "private_key": pem,
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    )


@pytest.mark.asyncio
async def test_verify_google_purchase_maps_purchased_state() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    account_json = _service_account_json(private_key)
    fake_client = _FakeGoogleHttpClient(
        token_response={"access_token": "access-token-abc"},
        purchase_response={
            "purchaseStateContext": {"purchaseState": "PURCHASED"},
            "productLineItem": [
                {
                    "productId": "ai.smartexpense.support.small",
                    "productOfferDetails": {
                        "purchaseOptionId": "buy",
                        "quantity": 1,
                        "refundableQuantity": 1,
                    },
                }
            ],
            "obfuscatedExternalAccountId": "c77bdcda-f90d-4b35-a3b1-55fca872e741",
            "regionCode": "SA",
        },
        product_response={
            "packageName": "com.smartexpense.ai",
            "productId": "ai.smartexpense.support.small",
            "purchaseOptions": [
                {
                    "purchaseOptionId": "buy",
                    "state": "ACTIVE",
                    "buyOption": {},
                    "regionalPricingAndAvailabilityConfigs": [
                        {
                            "regionCode": "SA",
                            "availability": "AVAILABLE",
                            "price": {
                                "currencyCode": "SAR",
                                "units": "5",
                                "nanos": 990000000,
                            },
                        }
                    ],
                }
            ],
        },
    )

    result = await pp.verify_google_purchase(
        package_name="com.smartexpense.ai",
        purchase_token="token-abc",
        expected_product_id="ai.smartexpense.support.small",
        expected_app_account_token="c77bdcda-f90d-4b35-a3b1-55fca872e741",
        service_account_json=account_json,
        http_client=fake_client,
    )

    assert result.state == "completed"
    assert result.product_id == "ai.smartexpense.support.small"
    assert result.provider_transaction_id == "token-abc"
    assert result.package_name == "com.smartexpense.ai"
    assert result.app_account_token == "c77bdcda-f90d-4b35-a3b1-55fca872e741"
    assert result.amount_minor_units == 599
    assert result.currency == "SAR"
    assert fake_client.requests[-1].endswith(
        "/applications/com.smartexpense.ai/oneTimeProducts/"
        "ai.smartexpense.support.small"
    )


@pytest.mark.asyncio
async def test_verify_google_purchase_snapshot_does_not_consult_current_catalog_price() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    account_json = _service_account_json(private_key)
    account_id = "c77bdcda-f90d-4b35-a3b1-55fca872e741"
    fake_client = _FakeGoogleHttpClient(
        token_response={"access_token": "access-token-abc"},
        purchase_response={
            "purchaseStateContext": {"purchaseState": "CANCELLED"},
            "productLineItem": [
                {
                    "productId": "ai.smartexpense.support.small",
                    "productOfferDetails": {
                        "purchaseOptionId": "retired-option",
                        "quantity": 1,
                        "refundableQuantity": 0,
                    },
                }
            ],
            "obfuscatedExternalAccountId": account_id,
        },
        # A historical purchase must remain verifiable even if the product
        # is no longer present in the current catalog.
        product_status=404,
    )

    snapshot = await pp.verify_google_purchase_snapshot(
        package_name=pp.MOBILE_APP_BUNDLE_ID,
        purchase_token="token-historical-refund",
        expected_product_id="ai.smartexpense.support.small",
        expected_app_account_token=account_id,
        service_account_json=account_json,
        http_client=fake_client,
    )

    assert snapshot.state == "cancelled"
    assert snapshot.product_id == "ai.smartexpense.support.small"
    assert snapshot.app_account_token == account_id
    assert snapshot.refundable_quantity == 0
    assert all("/oneTimeProducts/" not in request for request in fake_client.requests)


@pytest.mark.asyncio
async def test_verify_google_purchase_rejects_unknown_state() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    account_json = _service_account_json(private_key)
    fake_client = _FakeGoogleHttpClient(
        token_response={"access_token": "access-token-abc"},
        purchase_response={
            "purchaseStateContext": {"purchaseState": "SOME_FUTURE_STATE"},
            "productLineItem": [{"productId": "ai.smartexpense.support.small"}],
        },
    )

    with pytest.raises(pp.ProviderVerificationError):
        await pp.verify_google_purchase(
            package_name="com.smartexpense.ai",
            purchase_token="token-abc",
            service_account_json=account_json,
            http_client=fake_client,
        )


@pytest.mark.asyncio
async def test_verify_google_purchase_rejects_product_mismatch() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    account_json = _service_account_json(private_key)
    fake_client = _FakeGoogleHttpClient(
        token_response={"access_token": "access-token-abc"},
        purchase_response={
            "purchaseStateContext": {"purchaseState": "PURCHASED"},
            "productLineItem": [{"productId": "ai.smartexpense.support.medium"}],
        },
    )

    with pytest.raises(pp.ProviderVerificationError):
        await pp.verify_google_purchase(
            package_name="com.smartexpense.ai",
            purchase_token="token-abc",
            expected_product_id="ai.smartexpense.support.small",
            service_account_json=account_json,
            http_client=fake_client,
        )


@pytest.mark.asyncio
async def test_verify_google_purchase_rejects_account_ownership_mismatch() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    account_json = _service_account_json(private_key)
    fake_client = _FakeGoogleHttpClient(
        token_response={"access_token": "access-token-abc"},
        purchase_response={
            "purchaseStateContext": {"purchaseState": "PURCHASED"},
            "productLineItem": [
                {
                    "productId": "ai.smartexpense.support.small",
                    "productOfferDetails": {
                        "purchaseOptionId": "buy",
                        "quantity": 1,
                        "refundableQuantity": 1,
                    },
                }
            ],
            "obfuscatedExternalAccountId": "4e7f25bf-d736-41db-8d1d-2c05a8fef8c0",
            "regionCode": "SA",
        },
    )

    with pytest.raises(
        pp.ProviderVerificationError,
        match="different account",
    ):
        await pp.verify_google_purchase(
            package_name="com.smartexpense.ai",
            purchase_token="token-abc",
            expected_product_id="ai.smartexpense.support.small",
            expected_app_account_token="c77bdcda-f90d-4b35-a3b1-55fca872e741",
            service_account_json=account_json,
            http_client=fake_client,
        )


def test_google_catalog_price_rejects_package_mismatch() -> None:
    with pytest.raises(
        pp.ProviderVerificationError,
        match="different app or product",
    ):
        pp._google_catalog_price(
            {
                "packageName": "com.example.other",
                "productId": "ai.smartexpense.support.small",
                "purchaseOptions": [],
            },
            package_name="com.smartexpense.ai",
            product_id="ai.smartexpense.support.small",
            purchase_option_id="buy",
            region_code="SA",
        )


@pytest.mark.parametrize(
    "money",
    [
        {"currencyCode": "NOT-SAR", "units": "5", "nanos": 0},
        {"currencyCode": "SAR", "units": "5", "nanos": 1},
        {"currencyCode": "SAR", "units": "0", "nanos": 0},
    ],
)
def test_google_catalog_money_rejects_invalid_currency_or_minor_amount(
    money,
) -> None:
    with pytest.raises(pp.ProviderVerificationError):
        pp._google_money_minor_units(money)


def test_service_account_requires_needed_fields() -> None:
    with pytest.raises(pp.ProviderConfigurationError):
        pp._service_account(json.dumps({"client_email": "x@example.com"}))
