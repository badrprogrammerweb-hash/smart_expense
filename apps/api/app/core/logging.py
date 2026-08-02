import logging
import re
from typing import Any


_BEARER_RE = re.compile(r"Bearer\s+[A-Za-z0-9._~+/=-]+", re.IGNORECASE)
_EMAIL_RE = re.compile(r"\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b")


def redact_sensitive_text(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    value = _BEARER_RE.sub("Bearer [REDACTED]", value)
    return _EMAIL_RE.sub(r"\1***\2", value)


class SensitiveDataFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = redact_sensitive_text(record.msg)
        if isinstance(record.args, tuple):
            record.args = tuple(redact_sensitive_text(arg) for arg in record.args)
        elif isinstance(record.args, dict):
            record.args = {key: redact_sensitive_text(value) for key, value in record.args.items()}
        return True


_HANDLER_LOGGERS = ("", "uvicorn", "uvicorn.access", "uvicorn.error", "fastapi")
_DEFAULT_FORMAT = "%(levelname)s:%(name)s:%(message)s"


def _attach_sensitive_filter(handler: logging.Handler) -> None:
    if not any(isinstance(item, SensitiveDataFilter) for item in handler.filters):
        handler.addFilter(SensitiveDataFilter())


def configure_logging() -> None:
    root_logger = logging.getLogger()
    if not root_logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(_DEFAULT_FORMAT))
        root_logger.addHandler(handler)

    loggers = [logging.getLogger(name) for name in _HANDLER_LOGGERS]
    loggers.extend(
        logger
        for name, logger in logging.Logger.manager.loggerDict.items()
        if isinstance(logger, logging.Logger)
        and (name == "app" or name.startswith("app."))
        and logger not in loggers
    )

    for logger in loggers:
        logger.filters[:] = [
            item for item in logger.filters if not isinstance(item, SensitiveDataFilter)
        ]
        for handler in logger.handlers:
            _attach_sensitive_filter(handler)
