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


def configure_logging() -> None:
    sensitive_filter = SensitiveDataFilter()
    for logger_name in ("", "uvicorn", "uvicorn.access", "uvicorn.error", "fastapi"):
        logger = logging.getLogger(logger_name)
        if not any(isinstance(item, SensitiveDataFilter) for item in logger.filters):
            logger.addFilter(sensitive_filter)
