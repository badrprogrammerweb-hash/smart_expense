from __future__ import annotations

import logging

import pytest
from sqlalchemy import text

from conftest import AI_STUB_KEY, period_date, requires_supabase


pytestmark = [pytest.mark.acceptance, pytest.mark.asyncio, requires_supabase]

PDF_BYTES = b"%PDF-1.7\nphase-ten-ai-behavior"


def _assert_status(response, expected: int) -> None:
    assert response.status_code == expected, response.text


def _assert_key_absent(body: str) -> None:
    assert AI_STUB_KEY not in body
    assert AI_STUB_KEY[:-4] not in body
    assert AI_STUB_KEY[:12] not in body


async def _configure_ai(api_client, owner, workspace_id: str):
    return await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
        json={"provider": "openai", "api_key": AI_STUB_KEY},
    )


async def _upload(api_client, caller, workspace_id: str, filename: str):
    return await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=caller.auth_header,
        files={"file": (filename, PDF_BYTES, "application/pdf")},
    )


async def _dashboard_summary(api_client, caller, workspace_id: str) -> dict:
    response = await api_client.get(
        f"/workspaces/{workspace_id}/dashboard", headers=caller.auth_header
    )
    _assert_status(response, 200)
    return response.json()["summary"]


async def test_byok_key_never_in_response_log_or_error(
    api_client,
    acceptance_world,
    ai_provider_stub,
    monkeypatch,
    caplog,
) -> None:
    caplog.set_level(logging.WARNING)
    workspace_id = acceptance_world.workspace_a.id
    owner = acceptance_world.user_for_role("owner")

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    async def get_object(key: str) -> bytes:
        return PDF_BYTES

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.get_object", get_object)

    configure = await _configure_ai(api_client, owner, workspace_id)
    _assert_status(configure, 200)
    assert configure.json()["masked_hint"].endswith("abcd")
    _assert_key_absent(configure.text)

    status_response = await api_client.get(
        f"/workspaces/{workspace_id}/ai-settings", headers=owner.auth_header
    )
    _assert_status(status_response, 200)
    _assert_key_absent(status_response.text)

    upload = await _upload(api_client, owner, workspace_id, "secrecy-error.pdf")
    _assert_status(upload, 201)
    ai_provider_stub.fail_invalid_key()
    extraction_error = await api_client.post(
        f"/workspaces/{workspace_id}/files/{upload.json()['id']}/extractions",
        headers=owner.auth_header,
    )
    _assert_status(extraction_error, 200)
    assert extraction_error.json()["failure_reason"] == "invalid_key"
    _assert_key_absent(extraction_error.text)

    ai_provider_stub.fail_provider_error()
    summary_error = await api_client.post(
        f"/workspaces/{workspace_id}/reports/ai-summary",
        headers=owner.auth_header,
        json={"period": "current_month", "locale": "en"},
    )
    _assert_status(summary_error, 502)
    assert summary_error.json()["error"] == {
        "code": "ai_provider_error",
        "message": "The AI summary could not be generated right now.",
    }
    _assert_key_absent(summary_error.text)

    captured_logs = "\n".join(record.getMessage() for record in caplog.records)
    _assert_key_absent(captured_logs)
    assert "stubbed provider" not in extraction_error.text
    assert "stubbed provider" not in summary_error.text


async def test_unconfirmed_ai_moves_zero_totals(
    api_client, acceptance_world, ai_provider_stub, monkeypatch
) -> None:
    workspace_id = acceptance_world.workspace_a.id
    owner = acceptance_world.user_for_role("owner")

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    async def get_object(key: str) -> bytes:
        return PDF_BYTES

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.get_object", get_object)

    baseline = await _dashboard_summary(api_client, owner, workspace_id)
    configure = await _configure_ai(api_client, owner, workspace_id)
    _assert_status(configure, 200)

    upload = await _upload(api_client, owner, workspace_id, "unconfirmed-draft.pdf")
    _assert_status(upload, 201)
    ai_provider_stub.succeed()
    trigger = await api_client.post(
        f"/workspaces/{workspace_id}/files/{upload.json()['id']}/extractions",
        headers=owner.auth_header,
    )
    _assert_status(trigger, 200)
    assert trigger.json()["status"] == "ready_for_review"
    assert trigger.json()["draft"]["amount_minor"] == 4250
    assert trigger.json()["expense_id"] is None

    after = await _dashboard_summary(api_client, owner, workspace_id)
    assert after == baseline

    report = await api_client.get(
        f"/workspaces/{workspace_id}/reports?period=current_month",
        headers=owner.auth_header,
    )
    _assert_status(report, 200)
    assert report.json()["summary"] == baseline


async def test_provider_error_and_invalid_key_safe_and_no_data_corruption(
    api_client,
    acceptance_world,
    ai_provider_stub,
    db_connection,
    monkeypatch,
) -> None:
    workspace_id = acceptance_world.workspace_a.id
    owner = acceptance_world.user_for_role("owner")

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    async def get_object(key: str) -> bytes:
        return PDF_BYTES

    monkeypatch.setattr("app.services.storage.put_object", put_object)
    monkeypatch.setattr("app.services.storage.get_object", get_object)
    configure = await _configure_ai(api_client, owner, workspace_id)
    _assert_status(configure, 200)
    baseline = await _dashboard_summary(api_client, owner, workspace_id)

    scenarios = [
        ("invalid-key", ai_provider_stub.fail_invalid_key, "invalid_key"),
        ("provider-error", ai_provider_stub.fail_provider_error, "provider_error"),
    ]
    for filename, fail_provider, expected_reason in scenarios:
        upload = await _upload(api_client, owner, workspace_id, f"{filename}.pdf")
        _assert_status(upload, 201)
        file_id = upload.json()["id"]

        fail_provider()
        response = await api_client.post(
            f"/workspaces/{workspace_id}/files/{file_id}/extractions",
            headers=owner.auth_header,
        )
        _assert_status(response, 200)
        payload = response.json()
        assert payload["status"] == "failed"
        assert payload["failure_reason"] == expected_reason
        assert payload["draft"] is None
        assert payload["expense_id"] is None
        assert "stubbed provider" not in response.text
        _assert_key_absent(response.text)

        persisted = (
            await db_connection.execute(
                text(
                    """
                    select
                        f.status as file_status,
                        f.expense_id as file_expense_id,
                        ae.status as extraction_status,
                        ae.failure_reason,
                        ae.expense_id as extraction_expense_id
                    from public.files f
                    join public.ai_extractions ae on ae.file_id = f.id
                    where f.workspace_id = :workspace_id
                      and f.id = :file_id
                    order by ae.triggered_at desc
                    limit 1
                    """
                ),
                {"workspace_id": workspace_id, "file_id": file_id},
            )
        ).one()
        assert persisted.file_status == "active"
        assert persisted.file_expense_id is None
        assert persisted.extraction_status == "failed"
        assert persisted.failure_reason == expected_reason
        assert persisted.extraction_expense_id is None
        assert await _dashboard_summary(api_client, owner, workspace_id) == baseline

    assert len(ai_provider_stub.calls) == len(scenarios)


async def test_app_fully_usable_with_no_ai_key(
    api_client, acceptance_world, ai_provider_stub, monkeypatch
) -> None:
    workspace_id = acceptance_world.workspace_a.id
    owner = acceptance_world.user_for_role("owner")
    member = acceptance_world.user_for_role("member")

    async def put_object(key: str, content: bytes, content_type: str) -> None:
        return None

    monkeypatch.setattr("app.services.storage.put_object", put_object)

    settings = await api_client.get(
        f"/workspaces/{workspace_id}/ai-settings", headers=owner.auth_header
    )
    _assert_status(settings, 200)
    assert settings.json()["configured"] is False

    baseline = await _dashboard_summary(api_client, owner, workspace_id)
    income = await api_client.post(
        f"/workspaces/{workspace_id}/incomes",
        headers=owner.auth_header,
        json={
            "amount_minor": 12345,
            "occurred_on": period_date(10),
            "description": "Manual income without AI",
        },
    )
    _assert_status(income, 201)

    expense = await api_client.post(
        f"/workspaces/{workspace_id}/expenses",
        headers=member.auth_header,
        json={
            "amount_minor": 2345,
            "occurred_on": period_date(10),
            "category_id": acceptance_world.workspace_a.category_ids["groceries"],
            "merchant_name": "Manual purchase without AI",
        },
    )
    _assert_status(expense, 201)

    category = await api_client.post(
        f"/workspaces/{workspace_id}/categories",
        headers=owner.auth_header,
        json={"name": "Manual no-AI category", "category_type": "expense"},
    )
    _assert_status(category, 201)

    upload = await _upload(api_client, member, workspace_id, "manual-no-ai.pdf")
    _assert_status(upload, 201)
    trigger = await api_client.post(
        f"/workspaces/{workspace_id}/files/{upload.json()['id']}/extractions",
        headers=member.auth_header,
    )
    _assert_status(trigger, 409)
    assert trigger.json()["error"]["code"] == "ai_not_configured"

    summary = await _dashboard_summary(api_client, owner, workspace_id)
    assert summary["total_income_minor"] == baseline["total_income_minor"] + 12345
    assert summary["total_expenses_minor"] == baseline["total_expenses_minor"] + 2345
    assert summary["remaining_balance_minor"] == (
        summary["total_income_minor"] - summary["total_expenses_minor"]
    )

    report = await api_client.get(
        f"/workspaces/{workspace_id}/reports?period=current_month",
        headers=member.auth_header,
    )
    _assert_status(report, 200)
    assert report.json()["summary"] == summary

    for endpoint in ("incomes", "expenses", "categories?category_type=expense", "files"):
        listing = await api_client.get(
            f"/workspaces/{workspace_id}/{endpoint}", headers=member.auth_header
        )
        _assert_status(listing, 200)

    assert ai_provider_stub.calls == []
