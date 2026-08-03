"""Per-account, in-process throttling for costly authenticated operations."""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass
from threading import Lock

from fastapi import Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.core.config import get_settings


RATE_LIMIT_WINDOW_SECONDS = 60 * 60
DEFAULT_MAX_ENTRIES = 10_000


@dataclass
class _CounterEntry:
    window_start: float
    count: int
    sequence: int


class FixedWindowRateLimiter:
    """A bounded, lock-protected fixed-window counter."""

    def __init__(
        self,
        *,
        clock: Callable[[], float] = time.monotonic,
        window_seconds: float = RATE_LIMIT_WINDOW_SECONDS,
        max_entries: int = DEFAULT_MAX_ENTRIES,
    ) -> None:
        if window_seconds <= 0:
            raise ValueError("window_seconds must be positive")
        if max_entries <= 0:
            raise ValueError("max_entries must be positive")
        self._clock = clock
        self._window_seconds = window_seconds
        self._max_entries = max_entries
        self._entries: dict[tuple[str, str], _CounterEntry] = {}
        self._lock = Lock()
        self._sequence = 0
        self._latest_window_start: float | None = None

    def consume(self, user_id: str, bucket_name: str, allowance: int) -> bool:
        if allowance <= 0:
            raise ValueError("allowance must be positive")
        now = self._clock()
        window_start = now - (now % self._window_seconds)
        key = (str(user_id), bucket_name)

        with self._lock:
            if (
                self._latest_window_start is None
                or window_start > self._latest_window_start
            ):
                self._entries = {
                    entry_key: entry
                    for entry_key, entry in self._entries.items()
                    if entry.window_start >= window_start
                }
                self._latest_window_start = window_start

            entry = self._entries.get(key)
            if entry is None or entry.window_start != window_start:
                if entry is None and len(self._entries) >= self._max_entries:
                    oldest_key = min(
                        self._entries,
                        key=lambda candidate: (
                            self._entries[candidate].window_start,
                            self._entries[candidate].sequence,
                            candidate,
                        ),
                    )
                    del self._entries[oldest_key]
                self._sequence += 1
                entry = _CounterEntry(
                    window_start=window_start,
                    count=0,
                    sequence=self._sequence,
                )
                self._entries[key] = entry

            if entry.count >= allowance:
                return False
            entry.count += 1
            return True

    def reset(self) -> None:
        """Clear process-local counters; intended for deterministic tests."""

        with self._lock:
            self._entries.clear()
            self._sequence = 0
            self._latest_window_start = None

    @property
    def entry_count(self) -> int:
        with self._lock:
            return len(self._entries)


rate_limiter = FixedWindowRateLimiter()


def _rate_limited() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "code": "rate_limited",
            "message": "Too many requests. Try again later.",
        },
    )


def _enforce(current_user: CurrentUser, bucket_name: str, allowance: int) -> None:
    try:
        allowed = rate_limiter.consume(
            str(current_user.user_id),
            bucket_name,
            allowance,
        )
    except Exception:  # noqa: BLE001 - this security control deliberately fails closed
        raise _rate_limited() from None
    if not allowed:
        raise _rate_limited()


async def rate_limit_support_checkout(
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    _enforce(
        current_user,
        "support_checkout",
        get_settings().rate_limit_support_checkout,
    )


async def rate_limit_support_verify(
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    _enforce(
        current_user,
        "support_verify",
        get_settings().rate_limit_support_verify,
    )


async def rate_limit_ai_extraction(
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    _enforce(
        current_user,
        "ai_extraction",
        get_settings().rate_limit_ai_extraction,
    )


async def rate_limit_ai_summary(
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    _enforce(
        current_user,
        "ai_summary",
        get_settings().rate_limit_ai_summary,
    )
