import importlib
import inspect
import os
import time
from contextlib import contextmanager
from types import SimpleNamespace
from typing import Iterator

import httpx
import pytest

import app.core.config as config_module
import app.main as main_module
import app.routes.health as health_module
from app.core.auth import bootstrap_unavailable_exception


pytestmark = pytest.mark.asyncio


@contextmanager
def _fresh_application(
    monkeypatch: pytest.MonkeyPatch,
    *,
    app_env: str | None,
    pytest_current_test: str | None = None,
) -> Iterator[object]:
    """Construct an app only after the controlled environment is installed."""

    try:
        with monkeypatch.context() as environment:
            if app_env is None:
                environment.delenv("APP_ENV", raising=False)
            else:
                environment.setenv("APP_ENV", app_env)

            if pytest_current_test is None:
                environment.delenv("PYTEST_CURRENT_TEST", raising=False)
            else:
                environment.setenv("PYTEST_CURRENT_TEST", pytest_current_test)

            config_module.get_settings.cache_clear()
            fresh_main = importlib.reload(main_module)
            yield fresh_main.app
    finally:
        config_module.get_settings.cache_clear()
        # Restore the imported module to the caller's original environment so
        # this test module cannot affect later tests that import app.main.
        importlib.reload(main_module)


async def _request(app: object, path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        return await client.get(path)


@pytest.mark.parametrize(
    ("app_env", "expected_status"),
    [
        ("production", 404),
        (None, 404),
        ("", 404),
        ("staging-like-unknown", 404),
        ("dev", 200),
        (" DeVeLoPmEnT ", 200),
    ],
)
async def test_documentation_routes_follow_explicit_environment_policy(
    monkeypatch: pytest.MonkeyPatch,
    app_env: str | None,
    expected_status: int,
) -> None:
    with _fresh_application(monkeypatch, app_env=app_env) as app:
        responses = {
            path: await _request(app, path)
            for path in ("/docs", "/redoc", "/openapi.json")
        }

    assert {path: response.status_code for path, response in responses.items()} == {
        "/docs": expected_status,
        "/redoc": expected_status,
        "/openapi.json": expected_status,
    }
    if expected_status == 200:
        assert "text/html" in responses["/docs"].headers["content-type"]
        assert "text/html" in responses["/redoc"].headers["content-type"]
        assert responses["/openapi.json"].headers["content-type"].startswith(
            "application/json"
        )


def _contains_key(value: object, key: str) -> bool:
    if isinstance(value, dict):
        return key in value or any(_contains_key(item, key) for item in value.values())
    if isinstance(value, list):
        return any(_contains_key(item, key) for item in value)
    return False


async def _diagnostic_response(app: object) -> httpx.Response:
    @app.get("/_phase18/diagnostic-control")
    async def diagnostic_control() -> None:
        synthetic_error = SimpleNamespace(
            orig=RuntimeError("synthetic internal database detail")
        )
        raise bootstrap_unavailable_exception(synthetic_error)  # type: ignore[arg-type]

    return await _request(app, "/_phase18/diagnostic-control")


@pytest.mark.parametrize("app_env", ["production", None, "", "nonsense"])
async def test_diagnostics_fail_closed_outside_recognized_environments(
    monkeypatch: pytest.MonkeyPatch,
    app_env: str | None,
) -> None:
    with _fresh_application(monkeypatch, app_env=app_env) as app:
        response = await _diagnostic_response(app)

    payload = response.json()
    serialized = response.text.lower()
    assert response.status_code == 503
    assert payload["error"]["code"] == "workspace_bootstrap_unavailable"
    assert not _contains_key(payload, "diagnostic")
    assert "synthetic internal database detail" not in serialized
    assert "runtimeerror" not in serialized
    assert "traceback" not in serialized
    assert "postgresql://" not in serialized


async def test_dev_environment_keeps_existing_diagnostic_control(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with _fresh_application(monkeypatch, app_env="dev") as app:
        response = await _diagnostic_response(app)

    assert response.status_code == 503
    assert _contains_key(response.json(), "diagnostic")


async def test_pytest_compatibility_applies_only_when_app_env_is_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    marker = "tests/test_production_surface.py::diagnostic-control (call)"
    with _fresh_application(
        monkeypatch,
        app_env=None,
        pytest_current_test=marker,
    ) as app:
        unset_response = await _diagnostic_response(app)
    with _fresh_application(
        monkeypatch,
        app_env="production",
        pytest_current_test=marker,
    ) as app:
        production_response = await _diagnostic_response(app)

    assert _contains_key(unset_response.json(), "diagnostic")
    assert not _contains_key(production_response.json(), "diagnostic")


async def test_health_makes_no_outbound_network_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    def prohibited_urlopen(*_args: object, **_kwargs: object) -> object:
        calls.append("urlopen")
        raise AssertionError("health must not perform outbound network access")

    with _fresh_application(monkeypatch, app_env="production") as app:
        with monkeypatch.context() as network:
            network.setattr("urllib.request.urlopen", prohibited_urlopen)
            network.setattr(health_module, "urlopen", prohibited_urlopen, raising=False)
            response = await _request(app, "/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert calls == []


async def test_health_never_reads_service_role_credential(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    credential_reads: list[str] = []
    original_getenv = os.getenv

    def guarded_getenv(key: str, default: str | None = None) -> str | None:
        if key == "SUPABASE_SERVICE_ROLE_KEY":
            credential_reads.append(key)
            raise AssertionError("health must not read service-role credentials")
        return original_getenv(key, default)

    with _fresh_application(monkeypatch, app_env="production") as app:
        with monkeypatch.context() as credentials:
            credentials.setattr(os, "getenv", guarded_getenv)
            response = await _request(app, "/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert credential_reads == []


async def test_health_is_async_process_liveness_without_blocking_probe(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    legacy_probe_calls: list[str] = []

    def prohibited_database_probe() -> str:
        legacy_probe_calls.append("database")
        raise AssertionError("health must not invoke the legacy database probe")

    assert inspect.iscoroutinefunction(health_module.health)

    with _fresh_application(monkeypatch, app_env="production") as app:
        with monkeypatch.context() as health_environment:
            health_environment.setenv("SUPABASE_URL", "http://192.0.2.1:9")
            health_environment.setattr(
                health_module,
                "_database_status",
                prohibited_database_probe,
                raising=False,
            )
            started = time.monotonic()
            response = await _request(app, "/health")
            elapsed = time.monotonic() - started

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert legacy_probe_calls == []
    assert elapsed < 2.0
