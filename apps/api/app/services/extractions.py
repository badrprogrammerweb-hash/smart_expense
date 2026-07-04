"""AI extraction orchestration: trigger, confirm, and discard workflows.

Role/own-record checks, the lazy stale-`processing` self-heal, the
three-phase trigger flow, and the confirm/discard orchestration all live
here (research.md Decisions 7-10).
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
