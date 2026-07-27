"""Account-scoped web support-purchase routes."""

from __future__ import annotations

import logging
import re
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.config import get_settings
from app.core.support_tiers import SUPPORT_TIERS, SupportTier
from app.db import database_unavailable_exception, get_trusted_session
from app.schemas.support_purchases import (
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    MobilePurchaseVerifyRequest,
    SupportPurchaseListResponse,
    SupportPurchaseResponse,
    SupportTierListResponse,
    SupportTierResponse,
)
from app.services import payment_providers
from app.services.support_purchases import (
    InvalidSupportPurchaseTransition,
    SupportPurchaseConflict,
    SupportPurchaseRecord,
    create_pending,
    get_by_provider_transaction,
    get_owned_web_purchase_by_session,
    list_owned_purchases,
    mark_completed,
    mark_failed,
    mark_refunded,
)


router = APIRouter(prefix="/support-purchases", tags=["support-purchases"])
logger = logging.getLogger(__name__)

_TIERS_BY_ID = {tier.id: tier for tier in SUPPORT_TIERS}
_COMPLETED_EVENTS = {
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "payment_intent.succeeded",
}
_FAILED_EVENTS = {
    "checkout.session.async_payment_failed",
    "payment_intent.payment_failed",
}
_REFUND_EVENTS = {"charge.refunded", "refund.updated"}


def _display_amount(amount_minor_units: int) -> str:
    major, minor = divmod(amount_minor_units, 100)
    return f"{major}.{minor:02d}"


def _tier_response(tier: SupportTier) -> SupportTierResponse:
    return SupportTierResponse(
        tier_id=tier.id,
        label=tier.label,
        display_amount=_display_amount(tier.amount_minor_units),
        currency=tier.currency,
    )


def _purchase_response(record: SupportPurchaseRecord) -> SupportPurchaseResponse:
    return SupportPurchaseResponse(
        id=record.id,
        tier_id=record.tier_id,
        channel=record.channel,
        amount_minor_units=record.amount_minor_units,
        currency=record.currency,
        status=record.status,
        failure_reason=record.failure_reason,
        created_at=record.created_at,
        updated_at=record.updated_at,
        # A Google purchase token is a verification credential, not a receipt
        # reference. Keep it backend-only after the bridge submits it.
        provider_reference=(
            None
            if record.channel == "android"
            else record.provider_transaction_id
        ),
    )


def _mobile_mismatch() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail={
            "code": "mobile_purchase_mismatch",
            "message": "The store purchase does not match this support tier or account.",
        },
    )


def _valid_verified_amount_currency(
    amount_minor_units: object,
    currency: object,
) -> bool:
    return (
        isinstance(amount_minor_units, int)
        and not isinstance(amount_minor_units, bool)
        and amount_minor_units > 0
        and isinstance(currency, str)
        and re.fullmatch(r"[A-Z]{3}", currency) is not None
    )


def _verified_mobile_purchase_matches(
    verified: (
        payment_providers.VerifiedAppleTransaction
        | payment_providers.VerifiedGooglePurchase
    ),
    *,
    channel: str,
    provider_transaction_id: str,
    expected_product_id: str,
    user_id: str,
) -> bool:
    if (
        verified.provider_transaction_id != provider_transaction_id
        or verified.product_id != expected_product_id
        or verified.app_account_token is None
        or verified.app_account_token.lower() != user_id.lower()
        or not _valid_verified_amount_currency(
            verified.amount_minor_units, verified.currency
        )
    ):
        return False
    if channel == "apple":
        return (
            isinstance(verified, payment_providers.VerifiedAppleTransaction)
            and verified.bundle_id == payment_providers.MOBILE_APP_BUNDLE_ID
        )
    return (
        isinstance(verified, payment_providers.VerifiedGooglePurchase)
        and verified.package_name == payment_providers.MOBILE_APP_BUNDLE_ID
    )


def _web_app_origin(request: Request) -> str:
    settings = get_settings()
    request_origin = (request.headers.get("origin") or "").rstrip("/")
    allowed = {origin.rstrip("/") for origin in settings.cors_allow_origins}
    if request_origin in allowed:
        return request_origin
    return settings.cors_allow_origins[0].rstrip("/")


def _provider_object(event: payment_providers.VerifiedStripeEvent) -> dict:
    data = event.payload.get("data")
    value = data.get("object") if isinstance(data, dict) else None
    return dict(value) if isinstance(value, dict) else {}


async def _correlated_checkout_session_id(
    event: payment_providers.VerifiedStripeEvent,
) -> str | None:
    if event.provider_transaction_id is not None:
        return event.provider_transaction_id
    if event.payment_intent_id is None:
        return None
    return await payment_providers.resolve_stripe_checkout_session_id(
        event.payment_intent_id
    )


async def _apply_verified_stripe_event(
    session: AsyncSession,
    event: payment_providers.VerifiedStripeEvent,
    checkout_session_id: str,
) -> None:
    purchase = await get_by_provider_transaction(
        session,
        channel="web",
        provider_transaction_id=checkout_session_id,
    )
    if purchase is None:
        logger.info(
            "Discarding verified Stripe event %s: no matching Checkout Session.",
            event.event_id,
        )
        return

    provider_object = _provider_object(event)
    try:
        if event.event_type in _COMPLETED_EVENTS:
            if (
                event.event_type.startswith("checkout.session.")
                and provider_object.get("payment_status") != "paid"
            ):
                logger.info(
                    "Stripe event %s did not report a paid Checkout Session.",
                    event.event_id,
                )
                return
            await mark_completed(
                session,
                user_id=purchase.user_id,
                channel="web",
                provider_transaction_id=checkout_session_id,
            )
            return

        if event.event_type in _FAILED_EVENTS:
            await mark_failed(
                session,
                user_id=purchase.user_id,
                channel="web",
                provider_transaction_id=checkout_session_id,
                failure_reason="The payment could not be completed. You can try again.",
            )
            return

        if event.event_type in _REFUND_EVENTS:
            if event.event_type == "charge.refunded":
                if provider_object.get("refunded") is not True:
                    return
            elif (
                provider_object.get("status") != "succeeded"
                or provider_object.get("amount") != purchase.amount_minor_units
                or str(provider_object.get("currency") or "").upper()
                != purchase.currency.upper()
            ):
                # A partial Refund must not label the whole support purchase
                # refunded. Stripe emits charge.refunded with refunded=true
                # when the Charge itself is fully refunded.
                return
            # A verified refund proves a successful charge existed. When
            # delivery is out of order, preserve the state-machine contract
            # by applying both valid transitions rather than pending→refunded.
            if purchase.status == "pending":
                purchase = (
                    await mark_completed(
                        session,
                        user_id=purchase.user_id,
                        channel="web",
                        provider_transaction_id=checkout_session_id,
                    )
                    or purchase
                )
            if purchase.status == "completed":
                await mark_refunded(
                    session,
                    user_id=purchase.user_id,
                    channel="web",
                    provider_transaction_id=checkout_session_id,
                )
    except InvalidSupportPurchaseTransition:
        # A verified but late event must never reverse a terminal state.
        logger.info(
            "Ignoring out-of-order Stripe event %s for terminal purchase state.",
            event.event_id,
        )


@router.get("/tiers", response_model=SupportTierListResponse)
async def list_support_tiers(
    _: CurrentUser = Depends(get_current_user),
) -> SupportTierListResponse:
    return SupportTierListResponse(
        tiers=[_tier_response(tier) for tier in SUPPORT_TIERS]
    )


@router.get("", response_model=SupportPurchaseListResponse)
async def list_support_purchase_history(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_trusted_session),
) -> SupportPurchaseListResponse:
    try:
        purchases = await list_owned_purchases(
            session,
            user_id=current_user.user_id,
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc
    return SupportPurchaseListResponse(
        purchases=[_purchase_response(purchase) for purchase in purchases]
    )


@router.post(
    "/checkout-sessions",
    response_model=CheckoutSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_checkout_session(
    body: CheckoutSessionRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_trusted_session),
) -> CheckoutSessionResponse:
    tier = _TIERS_BY_ID.get(body.tier_id)
    if tier is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "unknown_support_tier",
                "message": "Choose one of the available support tiers.",
            },
        )

    result_url = (
        f"{_web_app_origin(request)}/{body.locale}/settings/support/result"
        "?session_id={CHECKOUT_SESSION_ID}"
    )
    try:
        checkout = await payment_providers.create_stripe_checkout_session(
            price_id=tier.stripe_price_id,
            success_url=result_url,
            cancel_url=result_url,
            user_id=str(current_user.user_id),
            tier_id=tier.id,
            idempotency_key=f"support-{current_user.user_id}-{uuid4()}",
        )
        purchase = await create_pending(
            session,
            user_id=current_user.user_id,
            tier_id=tier.id,
            channel="web",
            provider_transaction_id=checkout.id,
            amount_minor_units=checkout.amount_minor_units,
            currency=checkout.currency,
        )
    except payment_providers.ProviderConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "support_checkout_not_configured",
                "message": "Support checkout is not available right now.",
            },
        ) from exc
    except payment_providers.PaymentProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "support_checkout_unavailable",
                "message": "Support checkout is temporarily unavailable.",
            },
        ) from exc
    except SupportPurchaseConflict as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "support_checkout_conflict",
                "message": "This checkout attempt is already recorded.",
            },
        ) from exc
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    return CheckoutSessionResponse(
        purchase_id=purchase.id,
        checkout_url=checkout.url,
    )


@router.post(
    "/mobile/verify",
    response_model=SupportPurchaseResponse,
)
async def verify_mobile_purchase(
    body: MobilePurchaseVerifyRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_trusted_session),
) -> SupportPurchaseResponse:
    tier = _TIERS_BY_ID.get(body.tier_id)
    if tier is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "unknown_support_tier",
                "message": "Choose one of the available support tiers.",
            },
        )

    provider_transaction_id = body.provider_transaction_id.strip()
    if not provider_transaction_id:
        raise _mobile_mismatch()
    database_channel = "ios" if body.channel == "apple" else "android"
    expected_product_id = (
        tier.apple_product_id
        if body.channel == "apple"
        else tier.google_product_id
    )
    user_id = str(current_user.user_id)

    try:
        existing = await get_by_provider_transaction(
            session,
            channel=database_channel,
            provider_transaction_id=provider_transaction_id,
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    if existing is not None:
        if str(existing.user_id) != user_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "mobile_purchase_claimed",
                    "message": "This store transaction belongs to another account.",
                },
            )
        if existing.tier_id != tier.id:
            raise _mobile_mismatch()
        if existing.status in {"failed", "refunded"}:
            return _purchase_response(existing)

    try:
        if body.channel == "apple":
            settings = get_settings()
            environment = settings.apple_app_store_environment
            if environment not in {"Production", "Sandbox"}:
                raise payment_providers.ProviderConfigurationError(
                    "APPLE_APP_STORE_ENVIRONMENT must be Production or Sandbox."
                )
            verified = await payment_providers.verify_apple_purchase(
                transaction_id=provider_transaction_id,
                trusted_root_certificates=(
                    payment_providers.load_apple_trusted_root_certificates()
                ),
                expected_product_id=expected_product_id,
                bundle_id=payment_providers.MOBILE_APP_BUNDLE_ID,
                expected_app_account_token=user_id,
                environment=environment,
            )
        else:
            verified = await payment_providers.verify_google_purchase(
                package_name=payment_providers.MOBILE_APP_BUNDLE_ID,
                purchase_token=provider_transaction_id,
                expected_product_id=expected_product_id,
                expected_app_account_token=user_id,
            )
    except payment_providers.ProviderConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "mobile_verification_not_configured",
                "message": "Store purchase verification is not available right now.",
            },
        ) from exc
    except payment_providers.ProviderVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "mobile_purchase_not_verified",
                "message": "The store could not verify this support purchase.",
            },
        ) from exc
    except payment_providers.PaymentProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "mobile_verification_unavailable",
                "message": "Store purchase verification is temporarily unavailable.",
            },
        ) from exc

    if not _verified_mobile_purchase_matches(
        verified,
        channel=body.channel,
        provider_transaction_id=provider_transaction_id,
        expected_product_id=expected_product_id,
        user_id=user_id,
    ):
        raise _mobile_mismatch()

    try:
        purchase = await create_pending(
            session,
            user_id=current_user.user_id,
            tier_id=tier.id,
            channel=database_channel,
            provider_transaction_id=provider_transaction_id,
            amount_minor_units=verified.amount_minor_units,
            currency=verified.currency,
        )
        if (
            purchase.tier_id != tier.id
            or purchase.amount_minor_units != verified.amount_minor_units
            or purchase.currency != verified.currency
        ):
            raise _mobile_mismatch()

        if verified.state == "completed":
            purchase = (
                await mark_completed(
                    session,
                    user_id=current_user.user_id,
                    channel=database_channel,
                    provider_transaction_id=provider_transaction_id,
                )
                or purchase
            )
        elif verified.state in {"failed", "cancelled"}:
            purchase = (
                await mark_failed(
                    session,
                    user_id=current_user.user_id,
                    channel=database_channel,
                    provider_transaction_id=provider_transaction_id,
                    failure_reason=(
                        "The store reports that this support purchase was cancelled."
                        if verified.state == "cancelled"
                        else "The store could not complete this support purchase."
                    ),
                )
                or purchase
            )
        elif verified.state in {"refunded", "revoked"}:
            if purchase.status == "pending":
                purchase = (
                    await mark_completed(
                        session,
                        user_id=current_user.user_id,
                        channel=database_channel,
                        provider_transaction_id=provider_transaction_id,
                    )
                    or purchase
                )
            if purchase.status == "completed":
                purchase = (
                    await mark_refunded(
                        session,
                        user_id=current_user.user_id,
                        channel=database_channel,
                        provider_transaction_id=provider_transaction_id,
                    )
                    or purchase
                )
        # A verified provider-side pending state deliberately leaves the row
        # pending. No device-reported success value is accepted by this API.
    except SupportPurchaseConflict as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "mobile_purchase_claimed",
                "message": "This store transaction belongs to another account.",
            },
        ) from exc
    except InvalidSupportPurchaseTransition:
        # A later verification cannot move a terminal row backwards.
        try:
            purchase = await get_by_provider_transaction(
                session,
                channel=database_channel,
                provider_transaction_id=provider_transaction_id,
            )
        except DBAPIError as exc:
            raise database_unavailable_exception(exc) from exc
        if purchase is None or str(purchase.user_id) != user_id:
            raise _mobile_mismatch()
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    return _purchase_response(purchase)


@router.get(
    "/session/{checkout_session_id}",
    response_model=SupportPurchaseResponse,
)
async def get_web_purchase_status(
    checkout_session_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_trusted_session),
) -> SupportPurchaseResponse:
    if not checkout_session_id.startswith("cs_"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "support_purchase_not_found",
                "message": "Support purchase not found.",
            },
        )
    try:
        purchase = await get_owned_web_purchase_by_session(
            session,
            user_id=current_user.user_id,
            checkout_session_id=checkout_session_id,
        )
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc
    if purchase is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "support_purchase_not_found",
                "message": "Support purchase not found.",
            },
        )
    return _purchase_response(purchase)


@router.post("/webhooks/stripe", status_code=status.HTTP_204_NO_CONTENT)
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
    session: AsyncSession = Depends(get_trusted_session),
) -> Response:
    if not stripe_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "invalid_stripe_signature",
                "message": "The Stripe signature is invalid.",
            },
        )
    payload = await request.body()
    try:
        event = payment_providers.verify_stripe_webhook(
            payload, stripe_signature
        )
    except payment_providers.ProviderConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "stripe_webhook_not_configured",
                "message": "Stripe webhook verification is unavailable.",
            },
        ) from exc
    except payment_providers.ProviderVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "invalid_stripe_signature",
                "message": "The Stripe signature is invalid.",
            },
        ) from exc

    try:
        checkout_session_id = await _correlated_checkout_session_id(event)
        if checkout_session_id is not None:
            await _apply_verified_stripe_event(
                session, event, checkout_session_id
            )
    except payment_providers.PaymentProviderError as exc:
        # A transient correlation failure must be retried by Stripe rather
        # than acknowledged and silently lost.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "stripe_correlation_unavailable",
                "message": "Stripe event correlation is temporarily unavailable.",
            },
        ) from exc
    except DBAPIError as exc:
        raise database_unavailable_exception(exc) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)
