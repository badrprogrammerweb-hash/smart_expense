"""Verified payment-provider operations for one-time support purchases.

This module deliberately stops at provider authentication and normalization.
Only callers that receive one of the verified values below may ask the
support-purchase state machine to change a purchase's status.
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import hmac
import json
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal, Mapping, Sequence
from urllib.parse import quote

import httpx
import jwt
import stripe
from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric import dsa, ec, padding, rsa
from cryptography.hazmat.primitives.serialization import Encoding
from cryptography.x509.oid import ExtensionOID, ObjectIdentifier

from app.core.config import get_settings


MOBILE_APP_BUNDLE_ID = "com.smartexpense.ai"
GOOGLE_ANDROID_PUBLISHER_SCOPE = (
    "https://www.googleapis.com/auth/androidpublisher"
)
GOOGLE_PLAY_API_ROOT = "https://androidpublisher.googleapis.com"
GOOGLE_OIDC_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
APPLE_PRODUCTION_API_ROOT = "https://api.storekit.itunes.apple.com"
APPLE_SANDBOX_API_ROOT = "https://api.storekit-sandbox.itunes.apple.com"

_APPLE_LEAF_OID = ObjectIdentifier("1.2.840.113635.100.6.11.1")
_APPLE_INTERMEDIATE_OID = ObjectIdentifier("1.2.840.113635.100.6.2.1")
_CURRENCY_CODE = re.compile(r"^[A-Z]{3}$")
_CURRENCY_MINOR_UNIT_DIGITS = {
    # ISO 4217 currencies whose minor-unit exponent is not the usual 2.
    "BIF": 0,
    "CLF": 4,
    "CLP": 0,
    "DJF": 0,
    "GNF": 0,
    "ISK": 0,
    "JPY": 0,
    "KMF": 0,
    "KRW": 0,
    "PYG": 0,
    "RWF": 0,
    "UGX": 0,
    "UYI": 0,
    "UYW": 4,
    "VND": 0,
    "VUV": 0,
    "XAF": 0,
    "XOF": 0,
    "XPF": 0,
    "BHD": 3,
    "IQD": 3,
    "JOD": 3,
    "KWD": 3,
    "LYD": 3,
    "OMR": 3,
    "TND": 3,
}

StorePurchaseState = Literal[
    "pending",
    "completed",
    "failed",
    "cancelled",
    "refunded",
    "revoked",
]


class PaymentProviderError(Exception):
    """Base class for safe payment-provider failures."""


class ProviderConfigurationError(PaymentProviderError):
    """Required server-side provider configuration is missing or invalid."""


class ProviderVerificationError(PaymentProviderError):
    """A provider signal could not be authenticated or independently verified."""


@dataclass(frozen=True)
class StripeCheckoutSession:
    id: str
    url: str
    amount_minor_units: int
    currency: str


@dataclass(frozen=True)
class VerifiedStripeEvent:
    """A signature-verified Stripe event, with its correlation id(s) kept in
    their own identifier space rather than merged into one field.

    ``provider_transaction_id`` is populated **only** when the event's own
    provider object is the Checkout Session itself (e.g.
    ``checkout.session.completed``) — the same id
    :func:`create_stripe_checkout_session` hands back and the only value a
    ``support_purchases`` row is ever created with. ``payment_intent_id`` is
    populated whenever the event carries one (PaymentIntent and
    Charge/Refund events all reference a PaymentIntent id, never a Checkout
    Session id). The two are never the same identifier space, so callers
    MUST NOT use ``payment_intent_id`` as a ``provider_transaction_id``
    lookup key — a PaymentIntent/Charge/Refund event resolves to a purchase
    row only after its own correlation strategy (Phase 3) maps
    ``payment_intent_id`` back to the Checkout Session id that
    ``create_pending`` actually stored.
    """

    event_id: str
    event_type: str
    provider_transaction_id: str | None
    payment_intent_id: str | None
    payload: Mapping[str, Any]


@dataclass(frozen=True)
class VerifiedAppleTransaction:
    provider_transaction_id: str
    original_transaction_id: str | None
    product_id: str
    bundle_id: str
    app_account_token: str | None
    amount_minor_units: int | None
    currency: str | None
    state: StorePurchaseState
    payload: Mapping[str, Any]


@dataclass(frozen=True)
class VerifiedAppleNotification:
    notification_id: str
    notification_type: str
    provider_transaction_id: str
    product_id: str
    payload: Mapping[str, Any]
    transaction: Mapping[str, Any]


@dataclass(frozen=True)
class VerifiedGooglePurchase:
    """A server-verified snapshot of a Google Play one-time-product purchase.

    ``state`` intentionally allows the same four states the support-purchase
    state machine recognizes. Only the active-purchase states
    (``pending``/``completed``/``failed``) are currently mapped from
    ``purchaseStateContext.purchaseState`` below — voided/refunded Android
    purchases are expected to be learned from `verify_google_notification`'s
    `VOIDED_PURCHASE` notification type instead (mirroring how Apple's
    `REFUND` notification type, not a re-verified purchase state, drives
    `mark_refunded`), not from this function. This split is unconfirmed
    against Google's current Play Developer API responses and MUST be
    verified before Phase 3/4 wiring; do not assume it without checking.
    """

    provider_transaction_id: str
    product_id: str
    package_name: str
    app_account_token: str | None
    amount_minor_units: int
    currency: str
    state: StorePurchaseState
    payload: Mapping[str, Any]


@dataclass(frozen=True)
class VerifiedGoogleNotification:
    message_id: str
    notification_type: str
    provider_transaction_id: str
    product_id: str | None
    payload: Mapping[str, Any]


def _required(value: str, name: str) -> str:
    if not value:
        raise ProviderConfigurationError(f"{name} is not configured.")
    return value


def _currency_minor_unit_digits(currency: str) -> int:
    normalized = currency.upper()
    if not _CURRENCY_CODE.fullmatch(normalized):
        raise ProviderVerificationError(
            "The provider returned an invalid currency."
        )
    return _CURRENCY_MINOR_UNIT_DIGITS.get(normalized, 2)


def _apple_price_minor_units(
    price_milliunits: Any, currency: Any
) -> tuple[int, str]:
    if not isinstance(price_milliunits, int) or isinstance(
        price_milliunits, bool
    ):
        raise ProviderVerificationError(
            "The Apple transaction is missing its price."
        )
    if not isinstance(currency, str):
        raise ProviderVerificationError(
            "The Apple transaction is missing its currency."
        )
    normalized = currency.upper()
    scale = 10 ** _currency_minor_unit_digits(normalized)
    amount, remainder = divmod(price_milliunits * scale, 1000)
    if remainder or amount <= 0:
        raise ProviderVerificationError(
            "The Apple transaction price is not a valid minor-unit amount."
        )
    return amount, normalized


def _google_money_minor_units(value: Any) -> tuple[int, str]:
    if not isinstance(value, Mapping):
        raise ProviderVerificationError(
            "Google Play returned no regional price."
        )
    currency = value.get("currencyCode")
    if not isinstance(currency, str):
        raise ProviderVerificationError(
            "Google Play returned an invalid regional currency."
        )
    normalized = currency.upper()
    scale = 10 ** _currency_minor_unit_digits(normalized)
    try:
        units = int(value.get("units", 0))
        nanos = int(value.get("nanos", 0))
    except (TypeError, ValueError) as exc:
        raise ProviderVerificationError(
            "Google Play returned an invalid regional price."
        ) from exc
    if nanos < 0 or nanos >= 1_000_000_000:
        raise ProviderVerificationError(
            "Google Play returned an invalid regional price."
        )
    amount, remainder = divmod(
        (units * 1_000_000_000 + nanos) * scale,
        1_000_000_000,
    )
    if remainder or amount <= 0:
        raise ProviderVerificationError(
            "Google Play returned a non-minor-unit regional price."
        )
    return amount, normalized


def load_apple_trusted_root_certificates(
    value: str | None = None,
) -> tuple[bytes, ...]:
    """Load explicit Apple trust anchors from backend-only JSON config."""

    configured = (
        value
        if value is not None
        else get_settings().apple_app_store_root_certificates
    )
    try:
        entries = json.loads(configured)
    except (TypeError, json.JSONDecodeError) as exc:
        raise ProviderConfigurationError(
            "APPLE_APP_STORE_ROOT_CERTIFICATES must be a JSON array."
        ) from exc
    if not isinstance(entries, list) or not entries:
        raise ProviderConfigurationError(
            "APPLE_APP_STORE_ROOT_CERTIFICATES is not configured."
        )

    certificates: list[bytes] = []
    for entry in entries:
        if not isinstance(entry, str) or not entry.strip():
            raise ProviderConfigurationError(
                "APPLE_APP_STORE_ROOT_CERTIFICATES contains an invalid entry."
            )
        encoded = entry.strip()
        if encoded.startswith("-----BEGIN CERTIFICATE-----"):
            certificates.append(encoded.encode("ascii"))
            continue
        try:
            certificates.append(base64.b64decode(encoded, validate=True))
        except (ValueError, binascii.Error) as exc:
            raise ProviderConfigurationError(
                "APPLE_APP_STORE_ROOT_CERTIFICATES contains invalid base64."
            ) from exc
    return tuple(certificates)


def _mapping(value: Any) -> dict[str, Any]:
    if hasattr(value, "to_dict_recursive"):
        converted = value.to_dict_recursive()
        if isinstance(converted, dict):
            return converted
    if hasattr(value, "to_dict"):
        converted = value.to_dict()
        if isinstance(converted, dict):
            return converted
    if isinstance(value, Mapping):
        return dict(value)
    raise ProviderVerificationError("The provider returned an invalid response.")


async def create_stripe_checkout_session(
    *,
    price_id: str,
    success_url: str,
    cancel_url: str,
    user_id: str,
    tier_id: str,
    idempotency_key: str,
    secret_key: str | None = None,
) -> StripeCheckoutSession:
    """Create a Stripe-hosted one-time Checkout Session."""

    key = _required(
        secret_key if secret_key is not None else get_settings().stripe_secret_key,
        "STRIPE_SECRET_KEY",
    )
    client = stripe.StripeClient(key)
    params = {
        "mode": "payment",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "submit_type": "pay",
        "client_reference_id": user_id,
        "metadata": {"user_id": user_id, "tier_id": tier_id},
        "payment_intent_data": {
            "metadata": {"user_id": user_id, "tier_id": tier_id}
        },
    }

    try:
        session = await asyncio.to_thread(
            client.v1.checkout.sessions.create,
            params,
            {"idempotency_key": idempotency_key},
        )
    except stripe.StripeError as exc:
        raise PaymentProviderError("Stripe Checkout is temporarily unavailable.") from exc

    session_id = getattr(session, "id", None)
    checkout_url = getattr(session, "url", None)
    amount_total = getattr(session, "amount_total", None)
    currency = getattr(session, "currency", None)
    if (
        not isinstance(session_id, str)
        or not session_id.startswith("cs_")
        or not isinstance(checkout_url, str)
        or not isinstance(amount_total, int)
        or amount_total <= 0
        or not isinstance(currency, str)
    ):
        raise PaymentProviderError("Stripe returned an incomplete Checkout Session.")
    return StripeCheckoutSession(
        id=session_id,
        url=checkout_url,
        amount_minor_units=amount_total,
        currency=currency.upper(),
    )


async def resolve_stripe_checkout_session_id(
    payment_intent_id: str,
    *,
    secret_key: str | None = None,
) -> str | None:
    """Map a ``pi_...`` event reference to the stored ``cs_...`` reference.

    Stripe's Checkout Sessions list API has an explicit PaymentIntent filter.
    This server-side lookup is the only bridge between the identifier spaces;
    a PaymentIntent id is never used directly as a support-purchase key.
    """

    if not payment_intent_id.startswith("pi_"):
        raise ProviderVerificationError(
            "The Stripe PaymentIntent identifier is invalid."
        )
    key = _required(
        secret_key if secret_key is not None else get_settings().stripe_secret_key,
        "STRIPE_SECRET_KEY",
    )
    client = stripe.StripeClient(key)
    try:
        sessions = await asyncio.to_thread(
            client.v1.checkout.sessions.list,
            {"payment_intent": payment_intent_id, "limit": 2},
        )
    except stripe.StripeError as exc:
        raise PaymentProviderError(
            "Stripe correlation is temporarily unavailable."
        ) from exc

    data = getattr(sessions, "data", None)
    if not isinstance(data, list):
        mapped = _mapping(sessions)
        data = mapped.get("data")
    if not isinstance(data, list):
        raise PaymentProviderError("Stripe returned an invalid correlation response.")
    if not data:
        return None
    if len(data) != 1:
        raise ProviderVerificationError(
            "Stripe returned an ambiguous Checkout Session correlation."
        )
    checkout_session_id = (
        data[0].get("id")
        if isinstance(data[0], Mapping)
        else getattr(data[0], "id", None)
    )
    if not isinstance(checkout_session_id, str) or not checkout_session_id.startswith(
        "cs_"
    ):
        raise ProviderVerificationError(
            "Stripe returned an invalid Checkout Session identifier."
        )
    return checkout_session_id


def verify_stripe_webhook(
    payload: bytes,
    signature_header: str,
    *,
    webhook_secret: str | None = None,
    tolerance_seconds: int = 300,
) -> VerifiedStripeEvent:
    """Authenticate and normalize a Stripe webhook event."""

    secret = _required(
        webhook_secret
        if webhook_secret is not None
        else get_settings().stripe_webhook_signing_secret,
        "STRIPE_WEBHOOK_SIGNING_SECRET",
    )
    try:
        event = stripe.Webhook.construct_event(
            payload,
            signature_header,
            secret,
            tolerance=tolerance_seconds,
        )
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise ProviderVerificationError("The Stripe signature is invalid.") from exc

    event_payload = _mapping(event)
    event_id = event_payload.get("id")
    event_type = event_payload.get("type")
    data = event_payload.get("data")
    provider_object = data.get("object") if isinstance(data, Mapping) else None
    if not isinstance(provider_object, Mapping):
        raise ProviderVerificationError("The Stripe event has no provider object.")

    object_id = provider_object.get("id")
    is_checkout_session_event = (
        isinstance(event_type, str) and event_type.startswith("checkout.session.")
    )
    is_payment_intent_event = (
        isinstance(event_type, str) and event_type.startswith("payment_intent.")
    )

    # The Checkout Session id is the ONLY identifier `create_pending` is ever
    # called with (see `create_stripe_checkout_session`), so it is the only
    # value ever populated as `provider_transaction_id`. PaymentIntent and
    # Charge/Refund events reference a *different* identifier space (a
    # PaymentIntent id) and are surfaced only via `payment_intent_id` — never
    # coerced into `provider_transaction_id`, which would silently produce a
    # value no purchase row was ever created with.
    if is_checkout_session_event:
        provider_transaction_id = object_id if isinstance(object_id, str) else None
        payment_intent_id = provider_object.get("payment_intent")
    elif is_payment_intent_event:
        provider_transaction_id = None
        payment_intent_id = object_id
    elif event_type in {"charge.refunded", "refund.updated"}:
        provider_transaction_id = None
        payment_intent_id = provider_object.get("payment_intent")
    else:
        provider_transaction_id = None
        payment_intent_id = None

    if not isinstance(payment_intent_id, str):
        payment_intent_id = None
    if (
        provider_transaction_id is not None
        and not provider_transaction_id.startswith("cs_")
    ):
        raise ProviderVerificationError(
            "The Stripe Checkout Session identifier is invalid."
        )
    if payment_intent_id is not None and not payment_intent_id.startswith("pi_"):
        raise ProviderVerificationError(
            "The Stripe PaymentIntent identifier is invalid."
        )

    if (
        not isinstance(event_id, str)
        or not isinstance(event_type, str)
        or (provider_transaction_id is None and payment_intent_id is None)
    ):
        raise ProviderVerificationError("The Stripe event is missing an identifier.")

    return VerifiedStripeEvent(
        event_id=event_id,
        event_type=event_type,
        provider_transaction_id=provider_transaction_id,
        payment_intent_id=payment_intent_id,
        payload=event_payload,
    )


def _load_certificate(raw: bytes) -> x509.Certificate:
    try:
        if raw.lstrip().startswith(b"-----BEGIN CERTIFICATE-----"):
            return x509.load_pem_x509_certificate(raw)
        return x509.load_der_x509_certificate(raw)
    except ValueError as exc:
        raise ProviderConfigurationError(
            "An Apple root certificate is invalid."
        ) from exc


def _certificate_time(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _assert_certificate_valid_at(
    certificate: x509.Certificate, effective_time: datetime
) -> None:
    not_before = (
        certificate.not_valid_before_utc
        if hasattr(certificate, "not_valid_before_utc")
        else certificate.not_valid_before
    )
    not_after = (
        certificate.not_valid_after_utc
        if hasattr(certificate, "not_valid_after_utc")
        else certificate.not_valid_after
    )
    if not (
        _certificate_time(not_before)
        <= effective_time
        <= _certificate_time(not_after)
    ):
        raise ProviderVerificationError(
            "The Apple signing certificate is not valid at the signed time."
        )


def _verify_certificate_signature(
    certificate: x509.Certificate, issuer: x509.Certificate
) -> None:
    public_key = issuer.public_key()
    try:
        if isinstance(public_key, rsa.RSAPublicKey):
            public_key.verify(
                certificate.signature,
                certificate.tbs_certificate_bytes,
                padding.PKCS1v15(),
                certificate.signature_hash_algorithm,
            )
        elif isinstance(public_key, ec.EllipticCurvePublicKey):
            public_key.verify(
                certificate.signature,
                certificate.tbs_certificate_bytes,
                ec.ECDSA(certificate.signature_hash_algorithm),
            )
        elif isinstance(public_key, dsa.DSAPublicKey):
            public_key.verify(
                certificate.signature,
                certificate.tbs_certificate_bytes,
                certificate.signature_hash_algorithm,
            )
        else:
            raise ProviderVerificationError(
                "The Apple certificate uses an unsupported key type."
            )
    except InvalidSignature as exc:
        raise ProviderVerificationError(
            "The Apple certificate chain signature is invalid."
        ) from exc


def _assert_ca(certificate: x509.Certificate) -> None:
    try:
        constraints = certificate.extensions.get_extension_for_oid(
            ExtensionOID.BASIC_CONSTRAINTS
        ).value
    except x509.ExtensionNotFound as exc:
        raise ProviderVerificationError(
            "The Apple certificate chain has no CA constraint."
        ) from exc
    if not constraints.ca:
        raise ProviderVerificationError(
            "The Apple certificate chain contains a non-CA issuer."
        )


def _assert_extension(certificate: x509.Certificate, oid: ObjectIdentifier) -> None:
    try:
        certificate.extensions.get_extension_for_oid(oid)
    except x509.ExtensionNotFound as exc:
        raise ProviderVerificationError(
            "The Apple signing certificate has an invalid purpose."
        ) from exc


def _unverified_jws_payload(signed_payload: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            signed_payload,
            options={
                "verify_signature": False,
                "verify_exp": False,
                "verify_aud": False,
            },
        )
    except jwt.PyJWTError as exc:
        raise ProviderVerificationError("The Apple JWS payload is invalid.") from exc
    if not isinstance(payload, dict):
        raise ProviderVerificationError("The Apple JWS payload is invalid.")
    return payload


def _apple_effective_time(
    payload: Mapping[str, Any], fallback: datetime | None = None
) -> datetime:
    signed_date = payload.get("signedDate")
    if isinstance(signed_date, (int, float)):
        try:
            return datetime.fromtimestamp(signed_date / 1000, timezone.utc)
        except (OverflowError, OSError, ValueError) as exc:
            raise ProviderVerificationError(
                "The Apple signed date is invalid."
            ) from exc
    return fallback or datetime.now(timezone.utc)


def _verify_apple_jws(
    signed_payload: str,
    *,
    trusted_root_certificates: Sequence[bytes],
    effective_time: datetime | None = None,
) -> dict[str, Any]:
    """Verify an App Store Server JWS and its Apple x5c chain."""

    if not trusted_root_certificates:
        raise ProviderConfigurationError(
            "At least one trusted Apple root certificate is required."
        )
    try:
        header = jwt.get_unverified_header(signed_payload)
    except jwt.PyJWTError as exc:
        raise ProviderVerificationError("The Apple JWS header is invalid.") from exc
    if header.get("alg") != "ES256":
        raise ProviderVerificationError("The Apple JWS algorithm is invalid.")

    x5c = header.get("x5c")
    if not isinstance(x5c, list) or len(x5c) != 3:
        raise ProviderVerificationError(
            "The Apple JWS certificate chain is invalid."
        )
    try:
        chain = [
            x509.load_der_x509_certificate(base64.b64decode(item, validate=True))
            for item in x5c
            if isinstance(item, str)
        ]
    except (ValueError, binascii.Error) as exc:
        raise ProviderVerificationError(
            "The Apple JWS certificate chain is invalid."
        ) from exc
    if len(chain) != 3:
        raise ProviderVerificationError(
            "The Apple JWS certificate chain is invalid."
        )

    leaf, intermediate, supplied_root = chain
    trusted_roots = [_load_certificate(raw) for raw in trusted_root_certificates]
    trusted_root = next(
        (
            root
            for root in trusted_roots
            if root.public_bytes(Encoding.DER)
            == supplied_root.public_bytes(Encoding.DER)
        ),
        None,
    )
    if trusted_root is None:
        raise ProviderVerificationError("The Apple root certificate is untrusted.")

    unverified_payload = _unverified_jws_payload(signed_payload)
    verification_time = effective_time or _apple_effective_time(unverified_payload)
    for certificate in chain:
        _assert_certificate_valid_at(certificate, verification_time)
    _assert_ca(intermediate)
    _assert_ca(trusted_root)
    _assert_extension(leaf, _APPLE_LEAF_OID)
    _assert_extension(intermediate, _APPLE_INTERMEDIATE_OID)
    _verify_certificate_signature(leaf, intermediate)
    _verify_certificate_signature(intermediate, trusted_root)

    try:
        payload = jwt.decode(
            signed_payload,
            leaf.public_key(),
            algorithms=["ES256"],
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as exc:
        raise ProviderVerificationError("The Apple JWS signature is invalid.") from exc
    if not isinstance(payload, dict):
        raise ProviderVerificationError("The Apple JWS payload is invalid.")
    return payload


def _assert_apple_app(
    payload: Mapping[str, Any],
    *,
    bundle_id: str,
    environment: str | None,
    app_apple_id: int | None = None,
) -> None:
    if payload.get("bundleId") != bundle_id:
        raise ProviderVerificationError(
            "The Apple transaction belongs to a different app."
        )
    if environment is not None and payload.get("environment") != environment:
        raise ProviderVerificationError(
            "The Apple transaction belongs to a different environment."
        )
    if app_apple_id is not None and payload.get("appAppleId") not in (
        None,
        app_apple_id,
    ):
        raise ProviderVerificationError(
            "The Apple notification belongs to a different app."
        )


def verify_apple_signed_transaction(
    signed_transaction: str,
    *,
    trusted_root_certificates: Sequence[bytes],
    bundle_id: str = MOBILE_APP_BUNDLE_ID,
    environment: str | None = None,
    expected_product_id: str | None = None,
    expected_app_account_token: str | None = None,
    effective_time: datetime | None = None,
) -> VerifiedAppleTransaction:
    payload = _verify_apple_jws(
        signed_transaction,
        trusted_root_certificates=trusted_root_certificates,
        effective_time=effective_time,
    )
    _assert_apple_app(
        payload, bundle_id=bundle_id, environment=environment, app_apple_id=None
    )
    transaction_id = payload.get("transactionId") or payload.get(
        "originalTransactionId"
    )
    original_transaction_id = payload.get("originalTransactionId")
    product_id = payload.get("productId")
    if not isinstance(transaction_id, str) or not isinstance(product_id, str):
        raise ProviderVerificationError(
            "The Apple transaction is missing an identifier."
        )
    if expected_product_id is not None and product_id != expected_product_id:
        raise ProviderVerificationError(
            "The Apple transaction is for a different product."
        )
    app_account_token = payload.get("appAccountToken")
    if app_account_token is not None and not isinstance(app_account_token, str):
        raise ProviderVerificationError(
            "The Apple transaction has an invalid account token."
        )
    if expected_app_account_token is not None and (
        not isinstance(app_account_token, str)
        or not hmac.compare_digest(
            app_account_token.lower(), expected_app_account_token.lower()
        )
    ):
        raise ProviderVerificationError(
            "The Apple transaction belongs to a different account."
        )
    if payload.get("inAppOwnershipType") not in (None, "PURCHASED"):
        raise ProviderVerificationError(
            "The Apple transaction is not owned by this account."
        )

    amount_minor_units: int | None = None
    currency: str | None = None
    if payload.get("price") is not None or payload.get("currency") is not None:
        amount_minor_units, currency = _apple_price_minor_units(
            payload.get("price"), payload.get("currency")
        )

    return VerifiedAppleTransaction(
        provider_transaction_id=transaction_id,
        original_transaction_id=(
            original_transaction_id
            if isinstance(original_transaction_id, str)
            else None
        ),
        product_id=product_id,
        bundle_id=str(payload["bundleId"]),
        app_account_token=app_account_token,
        amount_minor_units=amount_minor_units,
        currency=currency,
        state="refunded" if payload.get("revocationDate") is not None else "completed",
        payload=payload,
    )


def verify_apple_jws_notification(
    signed_payload: str,
    *,
    trusted_root_certificates: Sequence[bytes],
    bundle_id: str = MOBILE_APP_BUNDLE_ID,
    environment: str | None = None,
    app_apple_id: int | None = None,
) -> VerifiedAppleNotification:
    payload = _verify_apple_jws(
        signed_payload, trusted_root_certificates=trusted_root_certificates
    )
    data = payload.get("data")
    if not isinstance(data, Mapping):
        raise ProviderVerificationError("The Apple notification has no data.")
    _assert_apple_app(
        data,
        bundle_id=bundle_id,
        environment=environment,
        app_apple_id=app_apple_id,
    )

    signed_transaction = data.get("signedTransactionInfo")
    if not isinstance(signed_transaction, str):
        raise ProviderVerificationError(
            "The Apple notification has no signed transaction."
        )
    transaction = verify_apple_signed_transaction(
        signed_transaction,
        trusted_root_certificates=trusted_root_certificates,
        bundle_id=bundle_id,
        environment=environment,
        effective_time=_apple_effective_time(payload),
    )
    notification_id = payload.get("notificationUUID")
    notification_type = payload.get("notificationType")
    if not isinstance(notification_id, str) or not isinstance(
        notification_type, str
    ):
        raise ProviderVerificationError(
            "The Apple notification is missing an identifier."
        )
    return VerifiedAppleNotification(
        notification_id=notification_id,
        notification_type=notification_type,
        provider_transaction_id=transaction.provider_transaction_id,
        product_id=transaction.product_id,
        payload=payload,
        transaction=transaction.payload,
    )


def _apple_server_token(
    *, issuer_id: str, key_id: str, private_key: str, bundle_id: str
) -> str:
    now = int(time.time())
    try:
        return jwt.encode(
            {
                "iss": issuer_id,
                "iat": now,
                "exp": now + 300,
                "aud": "appstoreconnect-v1",
                "bid": bundle_id,
            },
            private_key.replace("\\n", "\n"),
            algorithm="ES256",
            headers={"kid": key_id, "typ": "JWT"},
        )
    except (ValueError, TypeError, jwt.PyJWTError) as exc:
        raise ProviderConfigurationError(
            "The Apple App Store private key is invalid."
        ) from exc


async def verify_apple_purchase(
    *,
    transaction_id: str,
    trusted_root_certificates: Sequence[bytes],
    expected_product_id: str | None = None,
    expected_app_account_token: str | None = None,
    bundle_id: str = MOBILE_APP_BUNDLE_ID,
    environment: Literal["Production", "Sandbox"] = "Production",
    issuer_id: str | None = None,
    key_id: str | None = None,
    private_key: str | None = None,
    http_client: httpx.AsyncClient | None = None,
) -> VerifiedAppleTransaction:
    """Independently verify an Apple transaction via App Store Server API."""

    settings = get_settings()
    token = _apple_server_token(
        issuer_id=_required(
            issuer_id if issuer_id is not None else settings.apple_app_store_issuer_id,
            "APPLE_APP_STORE_ISSUER_ID",
        ),
        key_id=_required(
            key_id if key_id is not None else settings.apple_app_store_key_id,
            "APPLE_APP_STORE_KEY_ID",
        ),
        private_key=_required(
            private_key
            if private_key is not None
            else settings.apple_app_store_private_key,
            "APPLE_APP_STORE_PRIVATE_KEY",
        ),
        bundle_id=bundle_id,
    )
    root = (
        APPLE_SANDBOX_API_ROOT
        if environment == "Sandbox"
        else APPLE_PRODUCTION_API_ROOT
    )
    client = http_client or httpx.AsyncClient(timeout=20)
    try:
        response = await client.get(
            f"{root}/inApps/v1/transactions/{quote(transaction_id, safe='')}",
            headers={"Authorization": f"Bearer {token}"},
        )
        response.raise_for_status()
        body = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise ProviderVerificationError(
            "Apple could not verify this purchase."
        ) from exc
    finally:
        if http_client is None:
            await client.aclose()

    signed_transaction = (
        body.get("signedTransactionInfo") if isinstance(body, Mapping) else None
    )
    if not isinstance(signed_transaction, str):
        raise ProviderVerificationError(
            "Apple returned an incomplete transaction response."
        )
    transaction = verify_apple_signed_transaction(
        signed_transaction,
        trusted_root_certificates=trusted_root_certificates,
        bundle_id=bundle_id,
        environment=environment,
        expected_product_id=expected_product_id,
        expected_app_account_token=expected_app_account_token,
    )
    if transaction.provider_transaction_id != transaction_id:
        raise ProviderVerificationError(
            "Apple returned a different transaction identifier."
        )
    return transaction


def _service_account(value: str | Mapping[str, Any]) -> dict[str, Any]:
    if isinstance(value, Mapping):
        account = dict(value)
    else:
        try:
            account = json.loads(value)
        except (TypeError, json.JSONDecodeError) as exc:
            raise ProviderConfigurationError(
                "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is invalid."
            ) from exc
    required_fields = {"client_email", "private_key", "token_uri"}
    if not required_fields.issubset(account):
        raise ProviderConfigurationError(
            "The Google Play service account is incomplete."
        )
    return account


async def _google_access_token(
    account: Mapping[str, Any], http_client: httpx.AsyncClient
) -> str:
    now = int(time.time())
    try:
        assertion = jwt.encode(
            {
                "iss": account["client_email"],
                "scope": GOOGLE_ANDROID_PUBLISHER_SCOPE,
                "aud": account["token_uri"],
                "iat": now,
                "exp": now + 3600,
            },
            str(account["private_key"]).replace("\\n", "\n"),
            algorithm="RS256",
        )
        response = await http_client.post(
            str(account["token_uri"]),
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion,
            },
        )
        response.raise_for_status()
        body = response.json()
    except (KeyError, TypeError, ValueError, jwt.PyJWTError, httpx.HTTPError) as exc:
        raise ProviderVerificationError(
            "Google Play authentication failed."
        ) from exc
    access_token = body.get("access_token") if isinstance(body, Mapping) else None
    if not isinstance(access_token, str):
        raise ProviderVerificationError(
            "Google Play authentication returned no access token."
        )
    return access_token


def _google_line_item(body: Mapping[str, Any]) -> Mapping[str, Any]:
    line_items = body.get("productLineItem")
    if not isinstance(line_items, list) or len(line_items) != 1:
        raise ProviderVerificationError(
            "Google Play returned an invalid one-time product."
        )
    line_item = line_items[0]
    if not isinstance(line_item, Mapping):
        raise ProviderVerificationError(
            "Google Play returned an invalid one-time product."
        )
    return line_item


def _google_product_id(body: Mapping[str, Any]) -> str:
    product_id = _google_line_item(body).get("productId")
    if not isinstance(product_id, str):
        raise ProviderVerificationError(
            "Google Play returned no product identifier."
        )
    return product_id


def _google_purchase_option(
    body: Mapping[str, Any],
) -> tuple[str, int, int | None]:
    details = _google_line_item(body).get("productOfferDetails")
    if not isinstance(details, Mapping):
        raise ProviderVerificationError(
            "Google Play returned no purchase-option details."
        )
    purchase_option_id = details.get("purchaseOptionId")
    if not isinstance(purchase_option_id, str) or not purchase_option_id:
        raise ProviderVerificationError(
            "Google Play returned no purchase-option identifier."
        )
    if details.get("offerId") is not None:
        raise ProviderVerificationError(
            "Google Play returned an unsupported product offer."
        )
    quantity = details.get("quantity", 1)
    refundable_quantity = details.get("refundableQuantity")
    if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity != 1:
        raise ProviderVerificationError(
            "Google Play returned an unsupported purchase quantity."
        )
    if refundable_quantity is not None and (
        not isinstance(refundable_quantity, int)
        or isinstance(refundable_quantity, bool)
        or refundable_quantity not in (0, 1)
    ):
        raise ProviderVerificationError(
            "Google Play returned an invalid refundable quantity."
        )
    return purchase_option_id, quantity, refundable_quantity


def _google_catalog_price(
    body: Mapping[str, Any],
    *,
    package_name: str,
    product_id: str,
    purchase_option_id: str,
    region_code: str,
) -> tuple[int, str]:
    if (
        body.get("packageName") != package_name
        or body.get("productId") != product_id
    ):
        raise ProviderVerificationError(
            "The Google Play catalog returned a different app or product."
        )
    options = body.get("purchaseOptions")
    if not isinstance(options, list):
        raise ProviderVerificationError(
            "Google Play returned no purchase options."
        )
    matches = [
        option
        for option in options
        if isinstance(option, Mapping)
        and option.get("purchaseOptionId") == purchase_option_id
    ]
    if len(matches) != 1:
        raise ProviderVerificationError(
            "Google Play returned a different purchase option."
        )
    option = matches[0]
    if (
        option.get("state") != "ACTIVE"
        or not isinstance(option.get("buyOption"), Mapping)
        or option.get("rentOption") is not None
    ):
        raise ProviderVerificationError(
            "Google Play returned an unsupported purchase option."
        )
    regional = option.get("regionalPricingAndAvailabilityConfigs")
    if not isinstance(regional, list):
        raise ProviderVerificationError(
            "Google Play returned no regional pricing."
        )
    prices = [
        config
        for config in regional
        if isinstance(config, Mapping)
        and config.get("regionCode") == region_code
        and config.get("availability") == "AVAILABLE"
    ]
    if len(prices) != 1:
        raise ProviderVerificationError(
            "Google Play returned no matching regional price."
        )
    return _google_money_minor_units(prices[0].get("price"))


async def verify_google_purchase(
    *,
    package_name: str,
    purchase_token: str,
    expected_product_id: str | None = None,
    expected_app_account_token: str | None = None,
    service_account_json: str | Mapping[str, Any] | None = None,
    http_client: httpx.AsyncClient | None = None,
) -> VerifiedGooglePurchase:
    """Independently verify a one-time product with Google Play."""

    configured_account = (
        service_account_json
        if service_account_json is not None
        else get_settings().google_play_service_account_json
    )
    if http_client is None:
        async with httpx.AsyncClient(timeout=20) as client:
            return await verify_google_purchase(
                package_name=package_name,
                purchase_token=purchase_token,
                expected_product_id=expected_product_id,
                expected_app_account_token=expected_app_account_token,
                service_account_json=configured_account,
                http_client=client,
            )
    account = _service_account(configured_account)
    client = http_client
    try:
        access_token = await _google_access_token(account, client)
        response = await client.get(
            (
                f"{GOOGLE_PLAY_API_ROOT}/androidpublisher/v3/applications/"
                f"{quote(package_name, safe='')}/purchases/productsv2/tokens/"
                f"{quote(purchase_token, safe='')}"
            ),
            headers={"Authorization": f"Bearer {access_token}"},
        )
        response.raise_for_status()
        body = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise ProviderVerificationError(
            "Google Play could not verify this purchase."
        ) from exc
    if not isinstance(body, Mapping):
        raise ProviderVerificationError(
            "Google Play returned an invalid purchase response."
        )
    product_id = _google_product_id(body)
    if expected_product_id is not None and product_id != expected_product_id:
        raise ProviderVerificationError(
            "The Google Play purchase is for a different product."
        )
    purchase_option_id, _, refundable_quantity = _google_purchase_option(body)
    app_account_token = body.get("obfuscatedExternalAccountId")
    if app_account_token is not None and not isinstance(app_account_token, str):
        raise ProviderVerificationError(
            "Google Play returned an invalid account identifier."
        )
    if expected_app_account_token is not None and (
        not isinstance(app_account_token, str)
        or not hmac.compare_digest(
            app_account_token.lower(), expected_app_account_token.lower()
        )
    ):
        raise ProviderVerificationError(
            "The Google Play purchase belongs to a different account."
        )
    region_code = body.get("regionCode")
    if not isinstance(region_code, str) or not re.fullmatch(
        r"[A-Z]{2}", region_code
    ):
        raise ProviderVerificationError(
            "Google Play returned an invalid billing region."
        )
    state_context = body.get("purchaseStateContext")
    purchase_state = (
        state_context.get("purchaseState")
        if isinstance(state_context, Mapping)
        else None
    )
    states = {
        "PURCHASED": "completed",
        "PENDING": "pending",
        "CANCELLED": "cancelled",
    }
    state = states.get(purchase_state)
    if state is None:
        raise ProviderVerificationError(
            "Google Play returned an unknown purchase state."
        )
    if state == "completed" and refundable_quantity == 0:
        state = "refunded"

    try:
        product_response = await client.get(
            (
                f"{GOOGLE_PLAY_API_ROOT}/androidpublisher/v3/applications/"
                f"{quote(package_name, safe='')}/oneTimeProducts/"
                f"{quote(product_id, safe='')}"
            ),
            headers={"Authorization": f"Bearer {access_token}"},
        )
        product_response.raise_for_status()
        product_body = product_response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise ProviderVerificationError(
            "Google Play could not verify the product price."
        ) from exc
    if not isinstance(product_body, Mapping):
        raise ProviderVerificationError(
            "Google Play returned an invalid product response."
        )
    amount_minor_units, currency = _google_catalog_price(
        product_body,
        package_name=package_name,
        product_id=product_id,
        purchase_option_id=purchase_option_id,
        region_code=region_code,
    )
    return VerifiedGooglePurchase(
        provider_transaction_id=purchase_token,
        product_id=product_id,
        package_name=package_name,
        app_account_token=app_account_token,
        amount_minor_units=amount_minor_units,
        currency=currency,
        state=state,
        payload=dict(body),
    )


def _bearer_token(authorization_header: str) -> str:
    scheme, separator, token = authorization_header.partition(" ")
    if separator != " " or scheme.lower() != "bearer" or not token:
        raise ProviderVerificationError(
            "The Google Pub/Sub authorization header is invalid."
        )
    return token


def verify_google_notification(
    envelope: Mapping[str, Any],
    authorization_header: str,
    *,
    expected_audience: str,
    expected_service_account_email: str,
    jwk_client: jwt.PyJWKClient | None = None,
) -> VerifiedGoogleNotification:
    """Authenticate a Pub/Sub push and normalize its Play notification.

    The returned payload is still not authoritative purchase state; callers
    must pass its purchase token to :func:`verify_google_purchase`.
    """

    token = _bearer_token(authorization_header)
    keys = jwk_client or jwt.PyJWKClient(GOOGLE_OIDC_CERTS_URL)
    try:
        signing_key = keys.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=expected_audience,
            issuer=["https://accounts.google.com", "accounts.google.com"],
        )
    except (jwt.PyJWTError, ValueError) as exc:
        raise ProviderVerificationError(
            "The Google Pub/Sub identity token is invalid."
        ) from exc
    if (
        claims.get("email") != expected_service_account_email
        or claims.get("email_verified") is not True
    ):
        raise ProviderVerificationError(
            "The Google Pub/Sub sender is not authorized."
        )

    message = envelope.get("message")
    if not isinstance(message, Mapping):
        raise ProviderVerificationError("The Google Pub/Sub message is invalid.")
    message_id = message.get("messageId") or message.get("message_id")
    encoded_data = message.get("data")
    if not isinstance(message_id, str) or not isinstance(encoded_data, str):
        raise ProviderVerificationError(
            "The Google Pub/Sub message is incomplete."
        )
    try:
        notification = json.loads(
            base64.b64decode(encoded_data, validate=True).decode("utf-8")
        )
    except (binascii.Error, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ProviderVerificationError(
            "The Google Play notification payload is invalid."
        ) from exc
    if not isinstance(notification, Mapping):
        raise ProviderVerificationError(
            "The Google Play notification payload is invalid."
        )

    product = notification.get("oneTimeProductNotification")
    voided = notification.get("voidedPurchaseNotification")
    if isinstance(product, Mapping):
        purchase_token = product.get("purchaseToken")
        product_id = product.get("sku")
        notification_type = f"ONE_TIME_PRODUCT_{product.get('notificationType')}"
    elif isinstance(voided, Mapping):
        purchase_token = voided.get("purchaseToken")
        product_id = None
        notification_type = "VOIDED_PURCHASE"
    else:
        raise ProviderVerificationError(
            "The Google Play notification is not a supported purchase signal."
        )
    if not isinstance(purchase_token, str):
        raise ProviderVerificationError(
            "The Google Play notification has no purchase token."
        )
    if product_id is not None and not isinstance(product_id, str):
        raise ProviderVerificationError(
            "The Google Play notification has an invalid product identifier."
        )
    return VerifiedGoogleNotification(
        message_id=message_id,
        notification_type=notification_type,
        provider_transaction_id=purchase_token,
        product_id=product_id,
        payload=dict(notification),
    )


__all__ = [
    "MOBILE_APP_BUNDLE_ID",
    "PaymentProviderError",
    "ProviderConfigurationError",
    "ProviderVerificationError",
    "StripeCheckoutSession",
    "StorePurchaseState",
    "VerifiedAppleNotification",
    "VerifiedAppleTransaction",
    "VerifiedGoogleNotification",
    "VerifiedGooglePurchase",
    "VerifiedStripeEvent",
    "create_stripe_checkout_session",
    "load_apple_trusted_root_certificates",
    "resolve_stripe_checkout_session_id",
    "verify_apple_jws_notification",
    "verify_apple_purchase",
    "verify_apple_signed_transaction",
    "verify_google_notification",
    "verify_google_purchase",
    "verify_stripe_webhook",
]
