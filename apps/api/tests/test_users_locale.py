import pytest

from conftest import requires_supabase


pytestmark = [pytest.mark.asyncio, requires_supabase]


async def test_get_me_returns_current_users_locale(api_client, signup_user) -> None:
    user = await signup_user("users-locale-get")

    response = await api_client.get("/me", headers=user.auth_header)

    assert response.status_code == 200, response.text
    assert response.json() == {
        "id": user.user_id,
        "email": user.email,
        "display_name": None,
        "locale": "en",
    }


async def test_patch_me_persists_locale_across_requests(api_client, signup_user) -> None:
    user = await signup_user("users-locale-patch")

    patch_response = await api_client.patch("/me", headers=user.auth_header, json={"locale": "ar"})

    assert patch_response.status_code == 200, patch_response.text
    assert patch_response.json() == {"id": user.user_id, "locale": "ar"}

    get_response = await api_client.get("/me", headers=user.auth_header)

    assert get_response.status_code == 200, get_response.text
    assert get_response.json()["locale"] == "ar"


async def test_patch_me_rejects_invalid_locale(api_client, signup_user) -> None:
    user = await signup_user("users-locale-invalid")

    response = await api_client.patch("/me", headers=user.auth_header, json={"locale": "fr"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


async def test_me_requires_authentication(api_client) -> None:
    get_response = await api_client.get("/me")
    patch_response = await api_client.patch("/me", json={"locale": "ar"})

    assert get_response.status_code == 401
    assert get_response.json()["error"]["code"] == "unauthenticated"
    assert patch_response.status_code == 401
    assert patch_response.json()["error"]["code"] == "unauthenticated"
