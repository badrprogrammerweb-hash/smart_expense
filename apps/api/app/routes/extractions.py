"""Routes for AI extraction trigger, review, confirm, and discard."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.db import get_rls_session


router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["extractions"])
