import pytest
from sqlalchemy import text

from app.services import ai_providers
from conftest import create_team_workspace, default_category_id, requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]

OPENAI_KEY = "sk-test-0000000000000000abcd"
PDF_BYTES = b"%PDF-1.7\nvalid-pdf"


async def _configure_ai(api_client, owner, workspace_id: str) -> None:
    response = await api_client.put(
        f"/workspaces/{workspace_id}/ai-settings",
        headers=owner.auth_header,
        json={"provider": "openai", "api_key": OPENAI_KEY},
    )
    assert response.status_code == 200, response.text


async def _upload_file(api_client, user, workspace_id: str) -> dict:
    response = await api_client.post(
        f"/workspaces/{workspace_id}/files",
        headers=user.auth_header,
        files={"file": ("receipt.pdf", PDF_BYTES, "application/octet-stream")},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _trigger(api_client, user, workspace_id: str, file_id: str):
    return await api_client.post(
        f"/workspaces/{workspace_id}/files/{file_id}/extractions",
        headers=user.auth_header,
    )


def _stub_get_object(monkeypatch, content: bytes = PDF_BYTES) -> None:
    async def get_object(key: str) -> bytes:
        return content

    monkeypatch.setattr("app.services.storage.get_object", get_object)


def _stub_extract_receipt(monkeypatch, suggested_category: str | None):
    calls: list[dict] = []

    async def extract_receipt(provider, api_key, file_bytes, content_type, category_names=None):
        calls.append({"category_names": category_names})
        return ai_providers.ExtractedFields(
            amount_minor=4250,
            currency="SAR",
            occurred_on="2026-07-01",
            vendor_name="Test Merchant",
            suggested_category=suggested_category,
        )

    monkeypatch.setattr("app.services.ai_providers.extract_receipt", extract_receipt)
    return calls


async def test_suggestion_resolves_case_insensitively_to_active_category(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("extract-suggest-owner")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    await _configure_ai(api_client, owner, workspace_id)
    file = await _upload_file(api_client, owner, workspace_id)
    groceries_id = await default_category_id(db_connection, workspace_id, "Groceries")

    _stub_get_object(monkeypatch)
    _stub_extract_receipt(monkeypatch, "groceries")

    response = await _trigger(api_client, owner, workspace_id, file["id"])
    assert response.status_code == 200, response.text
    draft = response.json()["draft"]
    assert draft["suggested_category"] == "groceries"
    assert draft["suggested_category_id"] == groceries_id


async def test_suggestion_resolves_to_subcategory(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("extract-suggest-owner2")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    await _configure_ai(api_client, owner, workspace_id)
    file = await _upload_file(api_client, owner, workspace_id)
    dining_out_id = await default_category_id(db_connection, workspace_id, "Dining Out")

    _stub_get_object(monkeypatch)
    _stub_extract_receipt(monkeypatch, "Dining Out")

    response = await _trigger(api_client, owner, workspace_id, file["id"])
    assert response.status_code == 200, response.text
    draft = response.json()["draft"]
    assert draft["suggested_category_id"] == dining_out_id


async def test_suggestion_with_no_catalog_match_leaves_id_null_but_keeps_raw_text(
    api_client, signup_user, monkeypatch
) -> None:
    owner = await signup_user("extract-suggest-owner3")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    await _configure_ai(api_client, owner, workspace_id)
    file = await _upload_file(api_client, owner, workspace_id)

    _stub_get_object(monkeypatch)
    _stub_extract_receipt(monkeypatch, "Some Unlisted Category")

    response = await _trigger(api_client, owner, workspace_id, file["id"])
    assert response.status_code == 200, response.text
    draft = response.json()["draft"]
    assert draft["suggested_category"] == "Some Unlisted Category"
    assert draft["suggested_category_id"] is None


async def test_disabled_category_never_offered_as_prompt_candidate_or_suggestion(
    api_client, signup_user, db_connection, monkeypatch
) -> None:
    owner = await signup_user("extract-suggest-owner4")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    await _configure_ai(api_client, owner, workspace_id)
    file = await _upload_file(api_client, owner, workspace_id)
    restaurants_id = await default_category_id(db_connection, workspace_id, "Restaurants")

    await db_connection.execute(
        text("update public.categories set is_archived = true where id = :id"),
        {"id": restaurants_id},
    )
    await db_connection.commit()

    _stub_get_object(monkeypatch)
    calls = _stub_extract_receipt(monkeypatch, "Restaurants")

    response = await _trigger(api_client, owner, workspace_id, file["id"])
    assert response.status_code == 200, response.text

    assert "Restaurants" not in calls[0]["category_names"]
    assert "Dining Out" not in calls[0]["category_names"]

    draft = response.json()["draft"]
    assert draft["suggested_category"] == "Restaurants"
    assert draft["suggested_category_id"] is None


async def test_active_categories_all_offered_as_prompt_candidates(
    api_client, signup_user, monkeypatch
) -> None:
    owner = await signup_user("extract-suggest-owner5")
    workspace = await create_team_workspace(api_client, owner)
    workspace_id = workspace["id"]
    await _configure_ai(api_client, owner, workspace_id)
    file = await _upload_file(api_client, owner, workspace_id)

    _stub_get_object(monkeypatch)
    calls = _stub_extract_receipt(monkeypatch, None)

    response = await _trigger(api_client, owner, workspace_id, file["id"])
    assert response.status_code == 200, response.text

    category_names = calls[0]["category_names"]
    assert "Restaurants" in category_names
    assert "Dining Out" in category_names
    assert "Salary" not in category_names
