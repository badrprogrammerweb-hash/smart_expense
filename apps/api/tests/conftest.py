import os
import uuid
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import pytest
import pytest_asyncio
from dotenv import load_dotenv
from sqlalchemy import text

import app.db as db_module
from app.db import get_engine
from app.main import app


load_dotenv(Path(__file__).resolve().parents[1] / ".env")


@pytest_asyncio.fixture(autouse=True)
async def _reset_db_engine() -> AsyncIterator[None]:
    yield
    if db_module._engine is not None:
        await db_module._engine.dispose()
    db_module._engine = None
    db_module._session_factory = None


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
class TestUser:
    email: str
    password: str
    token: str
    user_id: str

    @property
    def auth_header(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}


@pytest_asyncio.fixture
async def api_client() -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest_asyncio.fixture
async def db_connection():
    engine = get_engine()
    async with engine.begin() as connection:
        yield connection


@pytest_asyncio.fixture
async def signup_user() -> Callable[[str | None], Any]:
    async def _signup_user(email_prefix: str | None = None) -> TestUser:
        supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
        service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        prefix = email_prefix or f"user-{uuid.uuid4().hex}"
        email = f"{prefix}@example.com"
        password = f"Correct-{uuid.uuid4().hex[:12]}-1"

        async with httpx.AsyncClient(
            base_url=supabase_url,
            timeout=10,
            trust_env=False,
        ) as client:
            response = await client.post(
                "/auth/v1/signup",
                headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
                json={"email": email, "password": password},
            )
        assert response.status_code in {200, 201}, response.text
        payload = response.json()
        token = payload.get("access_token") or payload.get("session", {}).get("access_token")
        user_id = payload.get("user", {}).get("id")
        assert token, payload
        assert user_id, payload
        return TestUser(email=email, password=password, token=token, user_id=user_id)

    return _signup_user


async def get_workspaces(client: httpx.AsyncClient, user: TestUser) -> list[dict[str, Any]]:
    response = await client.get("/workspaces", headers=user.auth_header)
    assert response.status_code == 200, response.text
    return response.json()["workspaces"]


async def personal_workspace_id(client: httpx.AsyncClient, user: TestUser) -> str:
    workspaces = await get_workspaces(client, user)
    personal = [workspace for workspace in workspaces if workspace["type"] == "personal"]
    assert len(personal) == 1
    return personal[0]["id"]


async def create_team_workspace(
    client: httpx.AsyncClient, owner: TestUser, name: str = "Family Budget"
) -> dict[str, Any]:
    response = await client.post("/workspaces", headers=owner.auth_header, json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()


async def add_member(
    client: httpx.AsyncClient,
    caller: TestUser,
    workspace_id: str,
    target: TestUser,
    role: str,
) -> httpx.Response:
    return await client.post(
        f"/workspaces/{workspace_id}/members",
        headers=caller.auth_header,
        json={"email": target.email, "role": role},
    )


async def list_members(
    client: httpx.AsyncClient, caller: TestUser, workspace_id: str
) -> list[dict[str, Any]]:
    response = await client.get(f"/workspaces/{workspace_id}/members", headers=caller.auth_header)
    assert response.status_code == 200, response.text
    return response.json()["members"]


async def member_for_email(
    client: httpx.AsyncClient, caller: TestUser, workspace_id: str, email: str
) -> dict[str, Any]:
    members = await list_members(client, caller, workspace_id)
    matches = [member for member in members if member["email"] == email]
    assert len(matches) == 1
    return matches[0]


async def set_role(
    client: httpx.AsyncClient,
    caller: TestUser,
    workspace_id: str,
    target_user_id: str,
    role: str,
) -> httpx.Response:
    return await client.patch(
        f"/workspaces/{workspace_id}/members/{target_user_id}",
        headers=caller.auth_header,
        json={"role": role},
    )


async def remove_member(
    client: httpx.AsyncClient,
    caller: TestUser,
    workspace_id: str,
    target_user_id: str,
) -> httpx.Response:
    return await client.delete(
        f"/workspaces/{workspace_id}/members/{target_user_id}",
        headers=caller.auth_header,
    )


async def ensure_personal_workspace(connection, user: TestUser) -> None:
    await connection.execute(
        text("select public.ensure_personal_workspace(:user_id, :email)"),
        {"user_id": user.user_id, "email": user.email},
    )


def period_date(day: int) -> str:
    from app.services.dashboard import get_current_period
    period_start, _ = get_current_period()
    return period_start.replace(day=day).isoformat()


async def create_income(
    client: httpx.AsyncClient,
    caller: TestUser,
    workspace_id: str,
    payload: dict[str, Any] | None = None,
) -> httpx.Response:
    body = {"amount_minor": 500000, "occurred_on": "2026-06-01"}
    if payload is not None:
        body.update(payload)
    return await client.post(
        f"/workspaces/{workspace_id}/incomes",
        headers=caller.auth_header,
        json=body,
    )


async def create_expense(
    client: httpx.AsyncClient,
    caller: TestUser,
    workspace_id: str,
    payload: dict[str, Any] | None = None,
) -> httpx.Response:
    body = {"amount_minor": 4500, "occurred_on": "2026-06-10"}
    if payload is not None:
        body.update(payload)
    return await client.post(
        f"/workspaces/{workspace_id}/expenses",
        headers=caller.auth_header,
        json=body,
    )


async def create_category(
    client: httpx.AsyncClient,
    caller: TestUser,
    workspace_id: str,
    payload: dict[str, Any] | None = None,
) -> httpx.Response:
    body = {"name": f"Category {uuid.uuid4().hex[:8]}"}
    if payload is not None:
        body.update(payload)
    return await client.post(
        f"/workspaces/{workspace_id}/categories",
        headers=caller.auth_header,
        json=body,
    )


async def list_incomes(
    client: httpx.AsyncClient, caller: TestUser, workspace_id: str
) -> list[dict[str, Any]]:
    response = await client.get(f"/workspaces/{workspace_id}/incomes", headers=caller.auth_header)
    assert response.status_code == 200, response.text
    return response.json()["incomes"]


async def list_expenses(
    client: httpx.AsyncClient, caller: TestUser, workspace_id: str
) -> list[dict[str, Any]]:
    response = await client.get(f"/workspaces/{workspace_id}/expenses", headers=caller.auth_header)
    assert response.status_code == 200, response.text
    return response.json()["expenses"]


async def list_categories(
    client: httpx.AsyncClient, caller: TestUser, workspace_id: str
) -> list[dict[str, Any]]:
    response = await client.get(f"/workspaces/{workspace_id}/categories", headers=caller.auth_header)
    assert response.status_code == 200, response.text
    return response.json()["categories"]


async def default_category_id(connection, workspace_id: str, name: str) -> str:
    result = await connection.execute(
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
