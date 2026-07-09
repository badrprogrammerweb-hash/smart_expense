from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import date
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from typing import Any

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import text

from app.db import get_engine
from app.services import ai_providers


AI_STUB_KEY = "sk-acceptance-0000000000000000abcd"

_CLEANUP_TRIGGERS = [
    ("ai_extractions", "ai_extractions_record_activity"),
    ("categories", "categories_record_activity"),
    ("expenses", "expenses_record_activity"),
    ("files", "files_record_activity"),
    ("incomes", "incomes_record_activity"),
    ("workspace_ai_settings", "workspace_ai_settings_record_activity"),
    ("workspace_memberships", "workspace_memberships_record_activity"),
    ("workspace_memberships", "workspace_memberships_protect_last_owner_delete"),
    ("workspace_memberships", "workspace_memberships_protect_last_owner_update"),
]


def _load_root_conftest():
    root_conftest_path = Path(__file__).resolve().parents[1] / "conftest.py"
    spec = spec_from_file_location("_smart_expense_root_conftest", root_conftest_path)
    assert spec is not None
    assert spec.loader is not None
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_root_conftest = _load_root_conftest()

TestUser = _root_conftest.TestUser
add_member = _root_conftest.add_member
create_category = _root_conftest.create_category
create_expense = _root_conftest.create_expense
create_income = _root_conftest.create_income
create_team_workspace = _root_conftest.create_team_workspace
default_category_id = _root_conftest.default_category_id
ensure_personal_workspace = _root_conftest.ensure_personal_workspace
get_workspaces = _root_conftest.get_workspaces
list_categories = _root_conftest.list_categories
list_expenses = _root_conftest.list_expenses
list_incomes = _root_conftest.list_incomes
list_members = _root_conftest.list_members
member_for_email = _root_conftest.member_for_email
period_date = _root_conftest.period_date
personal_workspace_id = _root_conftest.personal_workspace_id
remove_member = _root_conftest.remove_member
set_role = _root_conftest.set_role


def _has_supabase_env() -> bool:
    return bool(
        os.getenv("SUPABASE_URL", "").strip()
        and os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        and os.getenv("SUPABASE_DB_URL", "").strip()
    )


requires_supabase = pytest.mark.skipif(
    not _has_supabase_env(),
    reason="Requires local Supabase Auth/Postgres values in apps/api/.env",
)


@dataclass(frozen=True)
class AcceptanceRecords:
    confirmed_income_id: str
    confirmed_expense_id: str
    edited_income_id: str
    edited_expense_id: str
    deleted_income_id: str
    deleted_expense_id: str
    pending_ai_extraction_id: str
    draft_ai_extraction_id: str
    failed_ai_extraction_id: str
    workspace_b_income_id: str
    workspace_b_expense_id: str


@dataclass(frozen=True)
class AcceptanceWorkspace:
    id: str
    owner: Any
    category_ids: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class AcceptanceWorld:
    workspace_a: AcceptanceWorkspace
    workspace_b: AcceptanceWorkspace
    roles: dict[str, Any]
    records: AcceptanceRecords

    def user_for_role(self, role: str) -> Any:
        return self.roles[role]

    def auth_header_for_role(self, role: str) -> dict[str, str]:
        return self.user_for_role(role).auth_header

    def auth_header_for_workspace_b_owner(self) -> dict[str, str]:
        return self.workspace_b.owner.auth_header


class AcceptanceAiProviderStub:
    def __init__(self) -> None:
        self.calls: list[httpx.Request] = []
        self._handler = self._success_response

    def succeed(self) -> None:
        self._handler = self._success_response

    def fail_invalid_key(self) -> None:
        self.respond_with_status(401)

    def fail_provider_error(self) -> None:
        self.respond_with_status(500)

    def fail_rate_limited(self) -> None:
        self.respond_with_status(429)

    def timeout(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ReadTimeout("acceptance AI provider timeout", request=request)

        self._handler = handler

    def malformed(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, text="not valid provider json")

        self._handler = handler

    def respond_with_status(self, status_code: int) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(status_code, json={"error": {"message": "stubbed provider"}})

        self._handler = handler

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)
        return self._handler(request)

    def _success_response(self, request: httpx.Request) -> httpx.Response:
        try:
            payload = json.loads(request.content.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            payload = {}

        if "generativelanguage.googleapis.com" in str(request.url):
            if "generationConfig" in payload:
                text_payload = _extraction_json()
            else:
                text_payload = "Deterministic acceptance AI summary."
            return httpx.Response(
                200,
                json={
                    "candidates": [
                        {"content": {"parts": [{"text": text_payload}]}}
                    ]
                },
            )

        if payload.get("response_format"):
            text_payload = _extraction_json()
        else:
            text_payload = "Deterministic acceptance AI summary."
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": text_payload}}]},
        )


@pytest.fixture(autouse=True)
def ai_provider_stub(monkeypatch) -> AcceptanceAiProviderStub:
    stub = AcceptanceAiProviderStub()
    transport = httpx.MockTransport(stub.handler)
    real_async_client = httpx.AsyncClient

    def patched_async_client(*args, **kwargs):
        kwargs["transport"] = transport
        return real_async_client(*args, **kwargs)

    class ProviderHttpx:
        AsyncClient = staticmethod(patched_async_client)
        HTTPError = httpx.HTTPError

    monkeypatch.setattr(ai_providers, "httpx", ProviderHttpx)
    return stub


@pytest_asyncio.fixture
async def acceptance_world(api_client, signup_user) -> AcceptanceWorld:
    if not _has_supabase_env():
        pytest.skip("Requires local Supabase Auth/Postgres values in apps/api/.env")

    seed_user_ids: list[str] = []
    seed_workspace_ids: list[str] = []

    owner_a = await signup_user("acc-owner-a")
    admin_a = await signup_user("acc-admin-a")
    member_a = await signup_user("acc-member-a")
    viewer_a = await signup_user("acc-viewer-a")
    owner_b = await signup_user("acc-owner-b")
    seed_user_ids.extend(
        [owner_a.user_id, admin_a.user_id, member_a.user_id, viewer_a.user_id, owner_b.user_id]
    )

    try:
        workspace_a_response = await api_client.post(
            "/workspaces",
            headers=owner_a.auth_header,
            json={"name": "Acceptance Workspace A"},
        )
        assert workspace_a_response.status_code == 201, workspace_a_response.text
        workspace_a_id = workspace_a_response.json()["id"]
        seed_workspace_ids.append(workspace_a_id)

        workspace_b_response = await api_client.post(
            "/workspaces",
            headers=owner_b.auth_header,
            json={"name": "Acceptance Workspace B"},
        )
        assert workspace_b_response.status_code == 201, workspace_b_response.text
        workspace_b_id = workspace_b_response.json()["id"]
        seed_workspace_ids.append(workspace_b_id)

        for target, role in ((admin_a, "admin"), (member_a, "member"), (viewer_a, "viewer")):
            response = await api_client.post(
                f"/workspaces/{workspace_a_id}/members",
                headers=owner_a.auth_header,
                json={"email": target.email, "role": role},
            )
            assert response.status_code == 201, response.text

        async with get_engine().begin() as connection:
            category_ids = {
                "groceries": await _default_category_id(
                    connection, workspace_a_id, "Groceries"
                ),
                "restaurants": await _default_category_id(
                    connection, workspace_a_id, "Restaurants"
                ),
            }

        confirmed_income_id = await _create_income(
            api_client,
            owner_a,
            workspace_a_id,
            {"amount_minor": 250000, "occurred_on": _period_date(1), "description": "Salary"},
        )
        confirmed_expense_id = await _create_expense(
            api_client,
            member_a,
            workspace_a_id,
            {
                "amount_minor": 45000,
                "occurred_on": _period_date(2),
                "category_id": category_ids["groceries"],
                "merchant_name": "Acceptance Market",
                "description": "Confirmed groceries",
            },
        )

        edited_income_id = await _create_income(
            api_client,
            admin_a,
            workspace_a_id,
            {
                "amount_minor": 50000,
                "occurred_on": _period_date(3),
                "description": "Income before edit",
            },
        )
        income_patch = await api_client.patch(
            f"/workspaces/{workspace_a_id}/incomes/{edited_income_id}",
            headers=admin_a.auth_header,
            json={"amount_minor": 75000, "description": "Income after edit"},
        )
        assert income_patch.status_code == 200, income_patch.text

        edited_expense_id = await _create_expense(
            api_client,
            member_a,
            workspace_a_id,
            {
                "amount_minor": 9000,
                "occurred_on": _period_date(4),
                "category_id": category_ids["restaurants"],
                "merchant_name": "Before Edit Cafe",
            },
        )
        expense_patch = await api_client.patch(
            f"/workspaces/{workspace_a_id}/expenses/{edited_expense_id}",
            headers=member_a.auth_header,
            json={"amount_minor": 12000, "merchant_name": "After Edit Cafe"},
        )
        assert expense_patch.status_code == 200, expense_patch.text

        deleted_income_id = await _create_income(
            api_client,
            owner_a,
            workspace_a_id,
            {
                "amount_minor": 33000,
                "occurred_on": _period_date(5),
                "description": "Deleted income",
            },
        )
        income_delete = await api_client.delete(
            f"/workspaces/{workspace_a_id}/incomes/{deleted_income_id}",
            headers=owner_a.auth_header,
        )
        assert income_delete.status_code == 204, income_delete.text

        deleted_expense_id = await _create_expense(
            api_client,
            member_a,
            workspace_a_id,
            {
                "amount_minor": 18000,
                "occurred_on": _period_date(6),
                "category_id": category_ids["groceries"],
                "merchant_name": "Deleted Shop",
            },
        )
        expense_delete = await api_client.delete(
            f"/workspaces/{workspace_a_id}/expenses/{deleted_expense_id}",
            headers=member_a.auth_header,
        )
        assert expense_delete.status_code == 204, expense_delete.text

        workspace_b_income_id = await _create_income(
            api_client,
            owner_b,
            workspace_b_id,
            {
                "amount_minor": 50000,
                "occurred_on": _period_date(1),
                "description": "Workspace B income",
            },
        )
        workspace_b_expense_id = await _create_expense(
            api_client,
            owner_b,
            workspace_b_id,
            {
                "amount_minor": 70000,
                "occurred_on": _period_date(2),
                "merchant_name": "Workspace B Market",
                "description": "Workspace B negative balance expense",
            },
        )

        async with get_engine().begin() as connection:
            ai_records = await _insert_ai_edge_records(
                connection, workspace_a_id, member_a.user_id
            )

        yield AcceptanceWorld(
            workspace_a=AcceptanceWorkspace(
                id=workspace_a_id,
                owner=owner_a,
                category_ids=category_ids,
            ),
            workspace_b=AcceptanceWorkspace(
                id=workspace_b_id,
                owner=owner_b,
            ),
            roles={
                "owner": owner_a,
                "admin": admin_a,
                "member": member_a,
                "viewer": viewer_a,
            },
            records=AcceptanceRecords(
                confirmed_income_id=confirmed_income_id,
                confirmed_expense_id=confirmed_expense_id,
                edited_income_id=edited_income_id,
                edited_expense_id=edited_expense_id,
                deleted_income_id=deleted_income_id,
                deleted_expense_id=deleted_expense_id,
                pending_ai_extraction_id=ai_records["pending"],
                draft_ai_extraction_id=ai_records["draft"],
                failed_ai_extraction_id=ai_records["failed"],
                workspace_b_income_id=workspace_b_income_id,
                workspace_b_expense_id=workspace_b_expense_id,
            ),
        )
    finally:
        await _teardown_seed(seed_workspace_ids, seed_user_ids)


def _extraction_json() -> str:
    return (
        '{"amount_minor":4250,"currency":"SAR","occurred_on":"2026-07-01",'
        '"vendor_name":"Acceptance Provider","suggested_category":"Groceries"}'
    )


def _period_date(day: int) -> str:
    from app.services.dashboard import get_current_period

    period_start, _ = get_current_period()
    return period_start.replace(day=day).isoformat()


async def _create_income(
    api_client: httpx.AsyncClient,
    caller: Any,
    workspace_id: str,
    payload: dict[str, Any],
) -> str:
    response = await api_client.post(
        f"/workspaces/{workspace_id}/incomes",
        headers=caller.auth_header,
        json=payload,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def _create_expense(
    api_client: httpx.AsyncClient,
    caller: Any,
    workspace_id: str,
    payload: dict[str, Any],
) -> str:
    response = await api_client.post(
        f"/workspaces/{workspace_id}/expenses",
        headers=caller.auth_header,
        json=payload,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def _default_category_id(db_connection, workspace_id: str, name: str) -> str:
    result = await db_connection.execute(
        text(
            """
            select id
            from public.categories
            where workspace_id = :workspace_id
              and name = :name
              and not is_archived
            """
        ),
        {"workspace_id": workspace_id, "name": name},
    )
    row = result.first()
    assert row is not None, f"Default category {name!r} was not found."
    return str(row.id)


async def _insert_ai_edge_records(
    connection,
    workspace_id: str,
    user_id: str,
) -> dict[str, str]:
    pending = await _insert_ai_record(
        connection,
        workspace_id,
        user_id,
        status="processing",
        filename="acceptance-pending-ai.pdf",
        amount_minor=None,
    )
    draft = await _insert_ai_record(
        connection,
        workspace_id,
        user_id,
        status="ready_for_review",
        filename="acceptance-draft-ai.pdf",
        amount_minor=64000,
    )
    failed = await _insert_ai_record(
        connection,
        workspace_id,
        user_id,
        status="failed",
        filename="acceptance-failed-ai.pdf",
        amount_minor=81000,
        failure_reason="provider_error",
    )
    return {"pending": pending, "draft": draft, "failed": failed}


async def _insert_ai_record(
    connection,
    workspace_id: str,
    user_id: str,
    *,
    status: str,
    filename: str,
    amount_minor: int | None,
    failure_reason: str | None = None,
) -> str:
    file_result = await connection.execute(
        text(
            """
            insert into public.files (
                workspace_id, uploaded_by, original_filename, content_type,
                size_bytes, storage_path
            )
            values (
                :workspace_id, :user_id, :filename, 'application/pdf',
                256, :storage_path
            )
            returning id
            """
        ),
        {
            "workspace_id": workspace_id,
            "user_id": user_id,
            "filename": filename,
            "storage_path": f"{workspace_id}/{filename}",
        },
    )
    file_id = str(file_result.scalar_one())
    extraction_result = await connection.execute(
        text(
            """
            insert into public.ai_extractions (
                workspace_id, file_id, provider, status, amount_minor,
                extracted_currency, occurred_on, vendor_name, suggested_category,
                failure_reason, triggered_by
            )
            values (
                :workspace_id, :file_id, 'openai', :status, :amount_minor,
                'SAR', :occurred_on, :vendor_name, 'Groceries',
                :failure_reason, :user_id
            )
            returning id
            """
        ),
        {
            "workspace_id": workspace_id,
            "file_id": file_id,
            "status": status,
            "amount_minor": amount_minor,
            "occurred_on": date.fromisoformat(_period_date(7)),
            "vendor_name": f"Acceptance {status}",
            "failure_reason": failure_reason,
            "user_id": user_id,
        },
    )
    return str(extraction_result.scalar_one())


async def _teardown_seed(
    workspace_ids: list[str],
    user_ids: list[str],
) -> None:
    async with get_engine().begin() as connection:
        await _set_cleanup_triggers(connection, "disable")
        try:
            for workspace_id in workspace_ids:
                await connection.execute(
                    text("delete from public.activity_history where workspace_id = :workspace_id"),
                    {"workspace_id": workspace_id},
                )
            for workspace_id in workspace_ids:
                await connection.execute(
                    text("delete from public.workspaces where id = :workspace_id"),
                    {"workspace_id": workspace_id},
                )
            for user_id in user_ids:
                await connection.execute(
                    text("delete from public.user_profiles where id = :user_id"),
                    {"user_id": user_id},
                )
        finally:
            await _set_cleanup_triggers(connection, "enable")


async def _set_cleanup_triggers(connection, action: str) -> None:
    assert action in {"disable", "enable"}
    for table, trigger in _CLEANUP_TRIGGERS:
        await connection.execute(text(f"alter table public.{table} {action} trigger {trigger}"))
