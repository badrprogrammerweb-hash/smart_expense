"""Routes for receipt and invoice file operations."""

from __future__ import annotations

from fastapi import APIRouter


router = APIRouter(prefix="/workspaces/{workspace_id}/files", tags=["files"])
