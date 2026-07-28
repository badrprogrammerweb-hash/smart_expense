from uuid import uuid4

import pytest
from sqlalchemy import text

from app.services.support_purchases import (
    InvalidSupportPurchaseTransition,
    SupportPurchaseConflict,
    create_pending,
    mark_completed,
    mark_failed,
    mark_refunded,
)
from conftest import requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def _pending(db_connection, user_id: str, transaction_id: str, *, channel: str = "web"):
    return await create_pending(
        db_connection,
        user_id=user_id,
        tier_id="support_small",
        channel=channel,
        provider_transaction_id=transaction_id,
        amount_minor_units=500,
        currency="SAR",
    )


async def test_valid_state_transitions_and_repeated_terminal_events_are_idempotent(
    signup_user, db_connection
) -> None:
    user = await signup_user("support-state-valid")

    paid_transaction = f"cs_test_{uuid4().hex}"
    pending = await _pending(db_connection, user.user_id, paid_transaction)
    assert pending.status == "pending"
    assert pending.failure_reason is None

    completed = await mark_completed(
        db_connection,
        user_id=user.user_id,
        channel="web",
        provider_transaction_id=paid_transaction,
    )
    assert completed is not None
    assert completed.status == "completed"
    assert completed.failure_reason is None

    repeated_completed = await mark_completed(
        db_connection,
        user_id=user.user_id,
        channel="web",
        provider_transaction_id=paid_transaction,
    )
    assert repeated_completed == completed

    refunded = await mark_refunded(
        db_connection,
        user_id=user.user_id,
        channel="web",
        provider_transaction_id=paid_transaction,
    )
    assert refunded is not None
    assert refunded.status == "refunded"

    repeated_refund = await mark_refunded(
        db_connection,
        user_id=user.user_id,
        channel="web",
        provider_transaction_id=paid_transaction,
    )
    assert repeated_refund == refunded

    failed_transaction = f"cs_test_{uuid4().hex}"
    await _pending(db_connection, user.user_id, failed_transaction)
    failed = await mark_failed(
        db_connection,
        user_id=user.user_id,
        channel="web",
        provider_transaction_id=failed_transaction,
        failure_reason="payment_failed",
    )
    assert failed is not None
    assert failed.status == "failed"
    assert failed.failure_reason == "payment_failed"

    repeated_failed = await mark_failed(
        db_connection,
        user_id=user.user_id,
        channel="web",
        provider_transaction_id=failed_transaction,
        failure_reason="checkout_expired",
    )
    assert repeated_failed == failed


async def test_invalid_state_transitions_are_rejected(signup_user, db_connection) -> None:
    user = await signup_user("support-state-invalid")

    pending_transaction = f"cs_test_{uuid4().hex}"
    await _pending(db_connection, user.user_id, pending_transaction)
    with pytest.raises(InvalidSupportPurchaseTransition):
        await mark_refunded(
            db_connection,
            user_id=user.user_id,
            channel="web",
            provider_transaction_id=pending_transaction,
        )

    completed_transaction = f"cs_test_{uuid4().hex}"
    await _pending(db_connection, user.user_id, completed_transaction)
    await mark_completed(
        db_connection,
        user_id=user.user_id,
        channel="web",
        provider_transaction_id=completed_transaction,
    )
    with pytest.raises(InvalidSupportPurchaseTransition):
        await mark_failed(
            db_connection,
            user_id=user.user_id,
            channel="web",
            provider_transaction_id=completed_transaction,
            failure_reason="payment_failed",
        )

    failed_transaction = f"cs_test_{uuid4().hex}"
    await _pending(db_connection, user.user_id, failed_transaction)
    await mark_failed(
        db_connection,
        user_id=user.user_id,
        channel="web",
        provider_transaction_id=failed_transaction,
        failure_reason="payment_failed",
    )
    with pytest.raises(InvalidSupportPurchaseTransition):
        await mark_completed(
            db_connection,
            user_id=user.user_id,
            channel="web",
            provider_transaction_id=failed_transaction,
        )


async def test_duplicate_channel_transaction_is_a_noop_not_a_new_row(
    signup_user, db_connection
) -> None:
    owner = await signup_user("support-state-duplicate")
    other_user = await signup_user("support-state-conflict")
    transaction_id = f"google_{uuid4().hex}"

    first = await _pending(db_connection, owner.user_id, transaction_id, channel="android")
    duplicate = await create_pending(
        db_connection,
        user_id=owner.user_id,
        tier_id="support_large",
        channel="android",
        provider_transaction_id=transaction_id,
        amount_minor_units=5000,
        currency="USD",
    )
    assert duplicate == first

    row_count = int(
        (
            await db_connection.execute(
                text(
                    """
                    select count(*)::int
                    from public.support_purchases
                    where channel = 'android'
                      and provider_transaction_id = :transaction_id
                    """
                ),
                {"transaction_id": transaction_id},
            )
        ).scalar_one()
    )
    assert row_count == 1

    with pytest.raises(SupportPurchaseConflict):
        await _pending(db_connection, other_user.user_id, transaction_id, channel="android")


async def test_state_transitions_are_scoped_to_user_id(signup_user, db_connection) -> None:
    owner = await signup_user("support-state-owner")
    other_user = await signup_user("support-state-other")
    transaction_id = f"ios_{uuid4().hex}"
    await _pending(db_connection, owner.user_id, transaction_id, channel="ios")

    result = await mark_completed(
        db_connection,
        user_id=other_user.user_id,
        channel="ios",
        provider_transaction_id=transaction_id,
    )
    assert result is None

    status = (
        await db_connection.execute(
            text(
                """
                select status
                from public.support_purchases
                where channel = 'ios'
                  and provider_transaction_id = :transaction_id
                """
            ),
            {"transaction_id": transaction_id},
        )
    ).scalar_one()
    assert status == "pending"


async def test_failure_reason_is_normalized_before_storage(
    signup_user, db_connection
) -> None:
    user = await signup_user("support-state-safe-failure")
    transaction_id = f"cs_test_{uuid4().hex}"
    await _pending(db_connection, user.user_id, transaction_id)

    failed = await mark_failed(
        db_connection,
        user_id=user.user_id,
        channel="web",
        provider_transaction_id=transaction_id,
        failure_reason=(
            "card_declined: sk_test_secret pi_sensitive provider stack trace"
        ),
    )

    assert failed is not None
    assert failed.failure_reason == "payment_failed"
