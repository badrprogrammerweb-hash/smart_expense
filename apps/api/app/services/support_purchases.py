"""Account-scoped persistence and state transitions for support purchases."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal
from uuid import UUID

from sqlalchemy import text

from app.core.support_tiers import SUPPORT_TIERS


PurchaseChannel = Literal["web", "ios", "android"]
PurchaseStatus = Literal["pending", "completed", "failed", "refunded"]

_RETURNING_COLUMNS = """
    id,
    user_id,
    tier_id,
    channel,
    provider_transaction_id,
    amount_minor_units,
    currency,
    status,
    failure_reason,
    created_at,
    updated_at
"""


class SupportPurchaseConflict(Exception):
    """The provider transaction already belongs to a different account."""


class InvalidSupportPurchaseTransition(Exception):
    """The requested state change is not valid for the purchase's state."""


@dataclass(frozen=True)
class SupportPurchaseRecord:
    id: UUID
    user_id: UUID
    tier_id: str
    channel: PurchaseChannel
    provider_transaction_id: str
    amount_minor_units: int
    currency: str
    status: PurchaseStatus
    failure_reason: str | None
    created_at: datetime
    updated_at: datetime


def _record(row) -> SupportPurchaseRecord:
    return SupportPurchaseRecord(
        id=row.id,
        user_id=row.user_id,
        tier_id=row.tier_id,
        channel=row.channel,
        provider_transaction_id=row.provider_transaction_id,
        amount_minor_units=row.amount_minor_units,
        currency=row.currency,
        status=row.status,
        failure_reason=row.failure_reason,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def create_pending(
    session,
    *,
    user_id: str | UUID,
    tier_id: str,
    channel: PurchaseChannel,
    provider_transaction_id: str,
    amount_minor_units: int,
    currency: str,
) -> SupportPurchaseRecord:
    """Create one pending row, treating a replay for the same user as a no-op."""

    result = await session.execute(
        text(
            f"""
            insert into public.support_purchases (
                user_id,
                tier_id,
                channel,
                provider_transaction_id,
                amount_minor_units,
                currency
            )
            values (
                :user_id,
                :tier_id,
                :channel,
                :provider_transaction_id,
                :amount_minor_units,
                :currency
            )
            on conflict (channel, provider_transaction_id) do nothing
            returning {_RETURNING_COLUMNS}
            """
        ),
        {
            "user_id": user_id,
            "tier_id": tier_id,
            "channel": channel,
            "provider_transaction_id": provider_transaction_id,
            "amount_minor_units": amount_minor_units,
            "currency": currency,
        },
    )
    inserted = result.first()
    if inserted is not None:
        return _record(inserted)

    existing = (
        await session.execute(
            text(
                f"""
                select {_RETURNING_COLUMNS}
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
    ).first()
    if existing is None:
        raise SupportPurchaseConflict("The provider transaction could not be reserved.")

    record = _record(existing)
    if str(record.user_id) != str(user_id):
        raise SupportPurchaseConflict(
            "The provider transaction is already associated with another account."
        )
    return record


async def _transition(
    session,
    *,
    user_id: str | UUID,
    channel: PurchaseChannel,
    provider_transaction_id: str,
    source_status: PurchaseStatus,
    target_status: PurchaseStatus,
    failure_reason: str | None = None,
) -> SupportPurchaseRecord | None:
    result = await session.execute(
        text(
            f"""
            update public.support_purchases
            set status = :target_status,
                failure_reason = :failure_reason,
                updated_at = now()
            where user_id = :user_id
              and channel = :channel
              and provider_transaction_id = :provider_transaction_id
              and status = :source_status
            returning {_RETURNING_COLUMNS}
            """
        ),
        {
            "target_status": target_status,
            "failure_reason": failure_reason,
            "user_id": user_id,
            "channel": channel,
            "provider_transaction_id": provider_transaction_id,
            "source_status": source_status,
        },
    )
    changed = result.first()
    if changed is not None:
        return _record(changed)

    existing = (
        await session.execute(
            text(
                f"""
                select {_RETURNING_COLUMNS}
                from public.support_purchases
                where user_id = :user_id
                  and channel = :channel
                  and provider_transaction_id = :provider_transaction_id
                """
            ),
            {
                "user_id": user_id,
                "channel": channel,
                "provider_transaction_id": provider_transaction_id,
            },
        )
    ).first()
    if existing is None:
        return None

    record = _record(existing)
    if record.status == target_status:
        return record
    raise InvalidSupportPurchaseTransition(
        f"Cannot move a support purchase from {record.status} to {target_status}."
    )


async def mark_completed(
    session,
    *,
    user_id: str | UUID,
    channel: PurchaseChannel,
    provider_transaction_id: str,
) -> SupportPurchaseRecord | None:
    return await _transition(
        session,
        user_id=user_id,
        channel=channel,
        provider_transaction_id=provider_transaction_id,
        source_status="pending",
        target_status="completed",
    )


async def mark_failed(
    session,
    *,
    user_id: str | UUID,
    channel: PurchaseChannel,
    provider_transaction_id: str,
    failure_reason: str,
) -> SupportPurchaseRecord | None:
    safe_reason = failure_reason.strip() or "The purchase could not be completed."
    return await _transition(
        session,
        user_id=user_id,
        channel=channel,
        provider_transaction_id=provider_transaction_id,
        source_status="pending",
        target_status="failed",
        failure_reason=safe_reason,
    )


async def mark_refunded(
    session,
    *,
    user_id: str | UUID,
    channel: PurchaseChannel,
    provider_transaction_id: str,
) -> SupportPurchaseRecord | None:
    return await _transition(
        session,
        user_id=user_id,
        channel=channel,
        provider_transaction_id=provider_transaction_id,
        source_status="completed",
        target_status="refunded",
    )


async def get_by_provider_transaction(
    session,
    *,
    channel: PurchaseChannel,
    provider_transaction_id: str,
) -> SupportPurchaseRecord | None:
    """Trusted webhook lookup; callers must authenticate the provider first."""

    row = (
        await session.execute(
            text(
                f"""
                select {_RETURNING_COLUMNS}
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
    ).first()
    return _record(row) if row is not None else None


async def get_owned_web_purchase_by_session(
    session,
    *,
    user_id: str | UUID,
    checkout_session_id: str,
) -> SupportPurchaseRecord | None:
    """Read current provider-verified state for the signed-in owner."""

    row = (
        await session.execute(
            text(
                f"""
                select {_RETURNING_COLUMNS}
                from public.support_purchases
                where user_id = :user_id
                  and channel = 'web'
                  and provider_transaction_id = :checkout_session_id
                """
            ),
            {
                "user_id": user_id,
                "checkout_session_id": checkout_session_id,
            },
        )
    ).first()
    return _record(row) if row is not None else None


__all__ = [
    "SUPPORT_TIERS",
    "InvalidSupportPurchaseTransition",
    "SupportPurchaseConflict",
    "SupportPurchaseRecord",
    "create_pending",
    "get_by_provider_transaction",
    "get_owned_web_purchase_by_session",
    "mark_completed",
    "mark_failed",
    "mark_refunded",
]
