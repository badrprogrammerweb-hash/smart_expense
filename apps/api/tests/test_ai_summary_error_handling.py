import logging

import pytest

from app.services import ai_providers
from conftest import create_expense, create_income, create_team_workspace, period_date, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"
RAW_PROVIDER_DETAIL = "raw-provider-stack-trace-do-not-leak"


async def _configure_ai(api_client, owner, workspace_id: str) -> None:
    response = await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
        json={"provider": "openai", "api_key": OPENAI_KEY},
    )
    assert response.status_code == 200, response.text


async def _request_summary(api_client, user, workspace_id: str):
    return await api_client.post(
        f"/workspaces/{workspace_id}/reports/ai-summary",
        headers=user.auth_header,
        json={"period": "current_month", "locale": "en"},
    )


async def _report(api_client, user, workspace_id: str):
    return await api_client.get(f"/workspaces/{workspace_id}/reports", headers=user.auth_header)


def _assert_no_leak(response, caplog, *secrets: str) -> None:
    captured_logs = "\n".join(record.getMessage() for record in caplog.records)
    for secret in secrets:
        assert secret not in response.text
        assert secret not in captured_logs


async def test_invalid_key_and_provider_failure_return_safe_errors_without_breaking_report(
    api_client, signup_user, monkeypatch, caplog
) -> None:
    caplog.set_level(logging.WARNING)
    owner = await signup_user("ai-summary-error-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    await _configure_ai(api_client, owner, workspace_id)
    income = await create_income(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 110000, "occurred_on": period_date(1)},
    )
    expense = await create_expense(
        api_client,
        owner,
        workspace_id,
        {"amount_minor": 19000, "occurred_on": period_date(2)},
    )
    assert income.status_code == 201, income.text
    assert expense.status_code == 201, expense.text

    async def invalid_key(provider, api_key, aggregates, locale):
        raise ai_providers.AiSummaryInvalidKeyError(RAW_PROVIDER_DETAIL)

    monkeypatch.setattr(
        "app.services.ai_summary.ai_providers.summarize_spending",
        invalid_key,
    )
    invalid_response = await _request_summary(api_client, owner, workspace_id)
    assert invalid_response.status_code == 400, invalid_response.text
    assert invalid_response.json()["error"]["code"] == "ai_key_invalid"
    _assert_no_leak(invalid_response, caplog, OPENAI_KEY, RAW_PROVIDER_DETAIL)

    report_after_invalid_key = await _report(api_client, owner, workspace_id)
    assert report_after_invalid_key.status_code == 200, report_after_invalid_key.text
    assert report_after_invalid_key.json()["summary"]["total_expenses_minor"] == 19000

    async def provider_failure(provider, api_key, aggregates, locale):
        raise ai_providers.AiSummaryProviderError(RAW_PROVIDER_DETAIL)

    monkeypatch.setattr(
        "app.services.ai_summary.ai_providers.summarize_spending",
        provider_failure,
    )
    provider_response = await _request_summary(api_client, owner, workspace_id)
    assert provider_response.status_code == 502, provider_response.text
    assert provider_response.json()["error"]["code"] == "ai_provider_error"
    _assert_no_leak(provider_response, caplog, OPENAI_KEY, RAW_PROVIDER_DETAIL)

    report_after_provider_failure = await _report(api_client, owner, workspace_id)
    assert report_after_provider_failure.status_code == 200, report_after_provider_failure.text
    assert report_after_provider_failure.json()["summary"]["total_income_minor"] == 110000
