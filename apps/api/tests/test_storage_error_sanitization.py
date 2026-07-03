import logging

import httpx
import pytest

from app.services import storage


def test_storage_response_errors_redact_service_role_key(monkeypatch, caplog) -> None:
    class Settings:
        supabase_service_role_key = "service-role-secret"

    monkeypatch.setattr(storage, "get_settings", lambda: Settings())
    response = httpx.Response(
        500,
        text="storage failed for service-role-secret",
    )

    with caplog.at_level(logging.WARNING, logger="app.services.storage"):
        with pytest.raises(storage.StorageError):
            storage._raise_storage_response_error("put_object", response)

    assert "service-role-secret" not in caplog.text
    assert "<redacted>" in caplog.text
