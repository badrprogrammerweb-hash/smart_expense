from __future__ import annotations

import io
import logging
from collections.abc import Iterator

import pytest

from app.core import auth
from app.core.logging import SensitiveDataFilter, configure_logging


_CONFIGURED_LOGGERS = (
    "",
    "uvicorn",
    "uvicorn.access",
    "uvicorn.error",
    "fastapi",
    "app.services.storage",
)


@pytest.fixture
def isolated_logging() -> Iterator[None]:
    loggers = [logging.getLogger(name) for name in _CONFIGURED_LOGGERS]
    loggers.extend(
        logger
        for name, logger in logging.Logger.manager.loggerDict.items()
        if isinstance(logger, logging.Logger)
        and (name == "app" or name.startswith("app."))
        and logger not in loggers
    )
    original_state = {
        logger: {
            "handlers": list(logger.handlers),
            "filters": list(logger.filters),
            "level": logger.level,
            "propagate": logger.propagate,
            "disabled": logger.disabled,
        }
        for logger in loggers
    }

    for logger in loggers:
        logger.handlers.clear()
        logger.filters.clear()
        logger.setLevel(logging.NOTSET)
        logger.propagate = logger is not logging.getLogger()
        logger.disabled = False
    logging.getLogger().setLevel(logging.WARNING)

    try:
        yield
    finally:
        for logger, state in original_state.items():
            logger.handlers.clear()
            logger.handlers.extend(state["handlers"])
            logger.filters.clear()
            logger.filters.extend(state["filters"])
            logger.setLevel(state["level"])
            logger.propagate = state["propagate"]
            logger.disabled = state["disabled"]


def _capture_configured_output() -> tuple[io.StringIO, logging.StreamHandler]:
    output = io.StringIO()
    handler = logging.StreamHandler(output)
    handler.setFormatter(logging.Formatter("%(levelname)s:%(name)s:%(message)s"))
    logging.getLogger().addHandler(handler)
    configure_logging()
    return output, handler


def test_child_logger_redacts_bearer_and_email_in_handler_output(
    isolated_logging,
) -> None:
    output, _ = _capture_configured_output()
    logger = logging.getLogger("app.services.storage")
    raw_credential = "Bearer phase6.synthetic-token_123"
    raw_email = "phase6.user@example.test"

    logger.warning(f"request {raw_credential} for {raw_email}")

    rendered = output.getvalue()
    assert "Bearer [REDACTED]" in rendered
    assert raw_credential not in rendered
    assert "p***@example.test" in rendered
    assert raw_email not in rendered


def test_root_logger_remains_redacted_in_handler_output(isolated_logging) -> None:
    output, _ = _capture_configured_output()
    raw_credential = "Bearer phase6.root-token_456"
    raw_email = "root.user@example.test"

    logging.getLogger().warning("root %s for %s", raw_credential, raw_email)

    rendered = output.getvalue()
    assert "Bearer [REDACTED]" in rendered
    assert raw_credential not in rendered
    assert "r***@example.test" in rendered
    assert raw_email not in rendered


def test_formatting_arguments_are_redacted_in_handler_output(
    isolated_logging,
) -> None:
    output, _ = _capture_configured_output()
    raw_value = "Bearer phase6.argument-token_789"

    logging.getLogger("app.services.storage").warning(
        "storage credential: %s", raw_value
    )

    rendered = output.getvalue()
    assert "storage credential:" in rendered
    assert "Bearer [REDACTED]" in rendered
    assert raw_value not in rendered


def test_already_redacted_message_remains_readable(isolated_logging) -> None:
    output, _ = _capture_configured_output()
    message = (
        "Storage request failed for <redacted>, Bearer [REDACTED], "
        "and p***@example.test"
    )

    logging.getLogger("app.services.storage").warning(message)

    rendered = output.getvalue()
    assert message in rendered
    assert "[REDACTED][REDACTED]" not in rendered
    assert "<redacted><redacted>" not in rendered


def test_configure_logging_creates_one_handler_and_one_filter(
    isolated_logging,
) -> None:
    root_logger = logging.getLogger()
    pytest_handlers = list(root_logger.handlers)
    root_logger.handlers.clear()
    try:
        configure_logging()
        first_handlers = list(root_logger.handlers)
        configure_logging()

        assert len(first_handlers) == 1
        assert root_logger.handlers == first_handlers
        for handler in root_logger.handlers:
            assert sum(
                isinstance(item, SensitiveDataFilter) for item in handler.filters
            ) == 1
    finally:
        root_logger.handlers.clear()
        root_logger.handlers.extend(pytest_handlers)


def test_existing_auth_db_error_sanitizer_still_redacts_sensitive_values() -> None:
    raw_password = "phase6-db-password"
    raw_credential = "Bearer phase6.auth-token_123"
    raw_jwt = "eyJphase6Header.eyJphase6Payload.phase6Signature"
    raw_url = "postgresql://phase6-user:phase6-pass@db.example.test/app"

    class SyntheticDBError:
        orig = RuntimeError(
            f"password={raw_password} {raw_credential} {raw_jwt} {raw_url}"
        )

    rendered = auth._sanitized_db_error(SyntheticDBError())  # type: ignore[arg-type]

    assert "password=<redacted>" in rendered
    assert "Bearer <redacted>" in rendered
    assert "<jwt-redacted>" in rendered
    assert "postgresql://<redacted>" in rendered
    for raw_value in (raw_password, raw_credential, raw_jwt, raw_url):
        assert raw_value not in rendered
