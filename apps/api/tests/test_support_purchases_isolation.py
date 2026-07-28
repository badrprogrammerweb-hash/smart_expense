from pathlib import Path
import hashlib
import hmac
import json
import time
from uuid import uuid4

import pytest
from sqlalchemy import text

from app.core.config import get_settings
from app.services import payment_providers
from conftest import (
    create_expense,
    create_income,
    create_team_workspace,
    requires_supabase,
)


EXPECTED_COLUMNS = {
    "id",
    "user_id",
    "tier_id",
    "channel",
    "provider_transaction_id",
    "amount_minor_units",
    "currency",
    "status",
    "failure_reason",
    "created_at",
    "updated_at",
}


@pytest.mark.asyncio
@requires_supabase
async def test_support_purchases_schema_is_account_scoped_and_read_only_for_users(
    db_connection,
) -> None:
    columns = set(
        (
            await db_connection.execute(
                text(
                    """
                    select column_name
                    from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'support_purchases'
                    """
                )
            )
        ).scalars()
    )
    assert columns == EXPECTED_COLUMNS
    assert "workspace_id" not in columns

    foreign_keys = (
        await db_connection.execute(
            text(
                """
                select referenced.relname as referenced_table
                from pg_constraint constraint_row
                join pg_class source
                  on source.oid = constraint_row.conrelid
                join pg_namespace source_namespace
                  on source_namespace.oid = source.relnamespace
                join pg_class referenced
                  on referenced.oid = constraint_row.confrelid
                where constraint_row.contype = 'f'
                  and source_namespace.nspname = 'public'
                  and source.relname = 'support_purchases'
                """
            )
        )
    ).scalars().all()
    assert foreign_keys == ["user_profiles"]
    assert "workspaces" not in foreign_keys

    constraints = (
        await db_connection.execute(
            text(
                """
                select constraint_row.conname, pg_get_constraintdef(constraint_row.oid) as definition
                from pg_constraint constraint_row
                join pg_class source on source.oid = constraint_row.conrelid
                join pg_namespace source_namespace on source_namespace.oid = source.relnamespace
                where source_namespace.nspname = 'public'
                  and source.relname = 'support_purchases'
                """
            )
        )
    ).all()
    constraint_definitions = {
        row.conname: " ".join(row.definition.lower().split()) for row in constraints
    }
    assert constraint_definitions["support_purchases_channel_transaction_unique"] == (
        "unique (channel, provider_transaction_id)"
    )

    rls_enabled = (
        await db_connection.execute(
            text(
                """
                select relrowsecurity
                from pg_class table_row
                join pg_namespace table_namespace on table_namespace.oid = table_row.relnamespace
                where table_namespace.nspname = 'public'
                  and table_row.relname = 'support_purchases'
                """
            )
        )
    ).scalar_one()
    assert rls_enabled is True

    policies = (
        await db_connection.execute(
            text(
                """
                select cmd, roles, qual, with_check
                from pg_policies
                where schemaname = 'public'
                  and tablename = 'support_purchases'
                """
            )
        )
    ).all()
    assert len(policies) == 1
    assert policies[0].cmd == "SELECT"
    assert "authenticated" in policies[0].roles
    assert "user_id = auth.uid()" in policies[0].qual
    assert policies[0].with_check is None

    authenticated_grants = set(
        (
            await db_connection.execute(
                text(
                    """
                    select privilege_type
                    from information_schema.role_table_grants
                    where table_schema = 'public'
                      and table_name = 'support_purchases'
                      and grantee = 'authenticated'
                    """
                )
            )
        ).scalars()
    )
    assert authenticated_grants == {"SELECT"}


def test_workspace_query_services_never_reference_support_purchases() -> None:
    services_dir = Path(__file__).resolve().parents[1] / "app" / "services"
    for service_name in ("dashboard.py", "reports.py", "history.py"):
        source = (services_dir / service_name).read_text(encoding="utf-8").lower()
        assert "support_purchases" not in source, (
            f"{service_name} must remain isolated from support-purchase data"
        )


@pytest.mark.asyncio
@requires_supabase
async def test_completed_web_support_purchase_leaves_dashboard_and_reports_byte_identical(
    api_client, signup_user, monkeypatch
) -> None:
    user = await signup_user("support-financial-isolation")
    workspace = await create_team_workspace(
        api_client, user, name=f"Support isolation {uuid4().hex[:8]}"
    )
    workspace_id = workspace["id"]
    income = await create_income(
        api_client,
        user,
        workspace_id,
        {"amount_minor": 100_000, "occurred_on": "2026-07-01"},
    )
    expense = await create_expense(
        api_client,
        user,
        workspace_id,
        {"amount_minor": 25_000, "occurred_on": "2026-07-02"},
    )
    assert income.status_code == 201, income.text
    assert expense.status_code == 201, expense.text

    dashboard_path = f"/workspaces/{workspace_id}/dashboard"
    report_path = (
        f"/workspaces/{workspace_id}/reports"
        "?period=custom&start=2026-07-01&end=2026-07-31"
    )
    dashboard_before = await api_client.get(
        dashboard_path, headers=user.auth_header
    )
    report_before = await api_client.get(report_path, headers=user.auth_header)
    assert dashboard_before.status_code == 200
    assert report_before.status_code == 200

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
        headers=user.auth_header,
        json={"tier_id": "support_small", "locale": "en"},
    )
    assert checkout.status_code == 201, checkout.text

    webhook_secret = "whsec_isolation_test"
    monkeypatch.setenv("STRIPE_WEBHOOK_SIGNING_SECRET", webhook_secret)
    get_settings.cache_clear()
    webhook_payload = json.dumps(
        {
            "id": f"evt_{uuid4().hex}",
            "object": "event",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": checkout_session_id,
                    "object": "checkout.session",
                    "payment_status": "paid",
                }
            },
        },
        separators=(",", ":"),
    ).encode()
    timestamp = int(time.time())
    signature = hmac.new(
        webhook_secret.encode(),
        f"{timestamp}.".encode() + webhook_payload,
        hashlib.sha256,
    ).hexdigest()
    webhook = await api_client.post(
        "/support-purchases/webhooks/stripe",
        content=webhook_payload,
        headers={"Stripe-Signature": f"t={timestamp},v1={signature}"},
    )
    get_settings.cache_clear()
    assert webhook.status_code == 204, webhook.text

    dashboard_after = await api_client.get(
        dashboard_path, headers=user.auth_header
    )
    report_after = await api_client.get(report_path, headers=user.auth_header)

    assert dashboard_after.content == dashboard_before.content
    assert report_after.content == report_before.content


@pytest.mark.asyncio
@requires_supabase
async def test_every_purchase_state_leaves_access_limits_and_finances_invariant(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    user = await signup_user("support-all-state-isolation")
    workspace = await create_team_workspace(
        api_client, user, name=f"All-state isolation {uuid4().hex[:8]}"
    )
    workspace_id = workspace["id"]
    income = await create_income(
        api_client,
        user,
        workspace_id,
        {"amount_minor": 100_000, "occurred_on": "2026-07-01"},
    )
    expense = await create_expense(
        api_client,
        user,
        workspace_id,
        {"amount_minor": 25_000, "occurred_on": "2026-07-02"},
    )
    assert income.status_code == 201, income.text
    assert expense.status_code == 201, expense.text

    async def snapshot() -> dict[str, object]:
        profile = (
            await db_connection.execute(
                text(
                    """
                    select to_jsonb(profile_row)::text
                    from public.user_profiles profile_row
                    where id = :user_id
                    """
                ),
                {"user_id": user.user_id},
            )
        ).scalar_one()
        membership = (
            await db_connection.execute(
                text(
                    """
                    select to_jsonb(membership_row)::text
                    from public.workspace_memberships membership_row
                    where workspace_id = :workspace_id
                      and user_id = :user_id
                    """
                ),
                {"workspace_id": workspace_id, "user_id": user.user_id},
            )
        ).scalar_one()
        paths = {
            "workspaces": "/workspaces",
            "workspace": f"/workspaces/{workspace_id}",
            "members": f"/workspaces/{workspace_id}/members",
            "dashboard": f"/workspaces/{workspace_id}/dashboard",
            "reports": (
                f"/workspaces/{workspace_id}/reports"
                "?period=custom&start=2026-07-01&end=2026-07-31"
            ),
            "income": f"/workspaces/{workspace_id}/incomes",
            "expenses": f"/workspaces/{workspace_id}/expenses",
            "history": f"/workspaces/{workspace_id}/history?limit=50",
            "dashboard_limit": (
                f"/workspaces/{workspace_id}/dashboard?recent_limit=51"
            ),
            "history_limit": f"/workspaces/{workspace_id}/history?limit=51",
        }
        responses: dict[str, tuple[int, bytes]] = {}
        for name, path in paths.items():
            response = await api_client.get(path, headers=user.auth_header)
            responses[name] = (response.status_code, response.content)

        # These response codes are the concrete access/feature/limit surface
        # this product exposes. The complete payload is also compared below.
        assert responses["workspace"][0] == 200
        assert responses["members"][0] == 200
        assert responses["dashboard"][0] == 200
        assert responses["reports"][0] == 200
        assert responses["income"][0] == 200
        assert responses["expenses"][0] == 200
        assert responses["history"][0] == 200
        assert responses["dashboard_limit"][0] == 422
        assert responses["history_limit"][0] == 422
        return {
            "profile": profile,
            "membership": membership,
            "responses": responses,
        }

    baseline = await snapshot()
    session_ids = {
        purchase_status: f"cs_test_{purchase_status}_{uuid4().hex}"
        for purchase_status in ("pending", "completed", "failed", "refunded")
    }
    active_session_id = ""

    async def fake_create_checkout_session(**kwargs):
        return payment_providers.StripeCheckoutSession(
            id=active_session_id,
            url=f"https://checkout.stripe.com/c/pay/{active_session_id}",
            amount_minor_units=500,
            currency="SAR",
        )

    monkeypatch.setattr(
        payment_providers,
        "create_stripe_checkout_session",
        fake_create_checkout_session,
    )
    webhook_secret = "whsec_all_state_isolation"
    monkeypatch.setenv("STRIPE_WEBHOOK_SIGNING_SECRET", webhook_secret)
    get_settings.cache_clear()

    async def signed_event(event_type: str, provider_object: dict) -> None:
        payload = json.dumps(
            {
                "id": f"evt_{uuid4().hex}",
                "object": "event",
                "type": event_type,
                "data": {"object": provider_object},
            },
            separators=(",", ":"),
        ).encode()
        timestamp = int(time.time())
        signature = hmac.new(
            webhook_secret.encode(),
            f"{timestamp}.".encode() + payload,
            hashlib.sha256,
        ).hexdigest()
        response = await api_client.post(
            "/support-purchases/webhooks/stripe",
            content=payload,
            headers={"Stripe-Signature": f"t={timestamp},v1={signature}"},
        )
        assert response.status_code == 204, response.text

    for purchase_status, checkout_session_id in session_ids.items():
        active_session_id = checkout_session_id
        checkout = await api_client.post(
            "/support-purchases/checkout-sessions",
            headers=user.auth_header,
            json={"tier_id": "support_small", "locale": "en"},
        )
        assert checkout.status_code == 201, checkout.text

        if purchase_status == "completed":
            await signed_event(
                "checkout.session.completed",
                {
                    "id": checkout_session_id,
                    "object": "checkout.session",
                    "payment_status": "paid",
                },
            )
        elif purchase_status == "failed":
            await signed_event(
                "checkout.session.expired",
                {
                    "id": checkout_session_id,
                    "object": "checkout.session",
                    "payment_status": "unpaid",
                    "status": "expired",
                },
            )
        elif purchase_status == "refunded":
            payment_intent_id = f"pi_test_{uuid4().hex}"
            await signed_event(
                "checkout.session.completed",
                {
                    "id": checkout_session_id,
                    "object": "checkout.session",
                    "payment_intent": payment_intent_id,
                    "payment_status": "paid",
                },
            )

            async def resolve_payment_intent(value: str, **kwargs):
                assert value == payment_intent_id
                return checkout_session_id

            monkeypatch.setattr(
                payment_providers,
                "resolve_stripe_checkout_session_id",
                resolve_payment_intent,
            )
            await signed_event(
                "charge.refunded",
                {
                    "id": f"ch_test_{uuid4().hex}",
                    "object": "charge",
                    "payment_intent": payment_intent_id,
                    "refunded": True,
                },
            )

        state = (
            await db_connection.execute(
                text(
                    """
                    select status
                    from public.support_purchases
                    where channel = 'web'
                      and provider_transaction_id = :checkout_session_id
                    """
                ),
                {"checkout_session_id": checkout_session_id},
            )
        ).scalar_one()
        assert state == purchase_status
        assert await snapshot() == baseline

    get_settings.cache_clear()
