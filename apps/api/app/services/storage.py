"""Supabase Storage client helpers for private receipt and invoice files."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, NoReturn
from urllib.parse import quote
from uuid import UUID

import httpx

from app.core.config import get_settings


logger = logging.getLogger(__name__)

RECEIPTS_BUCKET = "receipts"
DEFAULT_SIGNED_URL_TTL_SECONDS = 300


class StorageError(RuntimeError):
    """Raised when Supabase Storage rejects or cannot complete an operation."""


def _validate_object_key(key: str) -> str:
    parts = key.split("/")
    if len(parts) != 2 or not all(parts):
        raise ValueError("Storage keys must use the {workspace_id}/{file_id} format.")

    UUID(parts[0])
    UUID(parts[1])
    return key


def _object_url(base_url: str, key: str) -> str:
    return f"{base_url.rstrip('/')}/storage/v1/object/{RECEIPTS_BUCKET}/{quote(key, safe='/')}"


def _sign_url(base_url: str, key: str) -> str:
    return f"{base_url.rstrip('/')}/storage/v1/object/sign/{RECEIPTS_BUCKET}/{quote(key, safe='/')}"


def _bucket_url(base_url: str) -> str:
    return f"{base_url.rstrip('/')}/storage/v1/object/{RECEIPTS_BUCKET}"


def _service_headers(content_type: str | None = None) -> dict[str, str]:
    settings = get_settings()
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
    }
    if content_type is not None:
        headers["Content-Type"] = content_type
    return headers


def _sanitized_response_body(response: httpx.Response) -> str:
    try:
        body = response.text
    except httpx.HTTPError:
        return "<unavailable>"
    return _redact_secret(body)[:500]


def _redact_secret(value: str) -> str:
    service_key = get_settings().supabase_service_role_key
    if service_key:
        value = value.replace(service_key, "<redacted>")
    return value


def _raise_storage_response_error(
    operation: str, response: httpx.Response, reason: str = "unexpected_status"
) -> NoReturn:
    logger.warning(
        "Supabase Storage %s failed (%s) with status %s: %s",
        operation,
        reason,
        response.status_code,
        _sanitized_response_body(response),
    )
    raise StorageError(f"Storage {operation} failed with status {response.status_code}.")


def _raise_storage_transport_error(operation: str, exc: httpx.HTTPError) -> NoReturn:
    logger.warning(
        "Supabase Storage %s request failed: %s",
        operation,
        _redact_secret(str(exc))[:500],
    )
    raise StorageError(f"Storage {operation} request failed.") from exc


@dataclass(frozen=True)
class SignedUrl:
    url: str
    expires_in: int


class SupabaseStorageClient:
    def __init__(self, base_url: str | None = None) -> None:
        self._base_url = (base_url or get_settings().supabase_url).rstrip("/")

    async def put_object(self, key: str, content: bytes, content_type: str) -> None:
        key = _validate_object_key(key)
        try:
            async with httpx.AsyncClient(timeout=30, trust_env=False) as client:
                response = await client.put(
                    _object_url(self._base_url, key),
                    headers={**_service_headers(content_type), "x-upsert": "false"},
                    content=content,
                )
        except httpx.HTTPError as exc:
            _raise_storage_transport_error("put_object", exc)
        if response.status_code not in {200, 201}:
            _raise_storage_response_error("put_object", response)

    async def sign_url(self, key: str, ttl: int = DEFAULT_SIGNED_URL_TTL_SECONDS) -> SignedUrl:
        key = _validate_object_key(key)
        ttl = min(max(ttl, 1), DEFAULT_SIGNED_URL_TTL_SECONDS)
        try:
            async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
                response = await client.post(
                    _sign_url(self._base_url, key),
                    headers=_service_headers("application/json"),
                    json={"expiresIn": ttl},
                )
        except httpx.HTTPError as exc:
            _raise_storage_transport_error("sign_url", exc)
        if response.status_code != 200:
            _raise_storage_response_error("sign_url", response)

        try:
            payload = response.json()
            signed_url = _extract_signed_url(payload)
        except ValueError:
            _raise_storage_response_error("sign_url", response, "invalid_json")
        except StorageError as exc:
            _raise_storage_response_error("sign_url", response, str(exc))
        if signed_url.startswith("/"):
            # Supabase returns a path relative to the storage service root
            # (e.g. "/object/sign/receipts/<key>?token=..."), which is mounted
            # at "/storage/v1" — matching the request URLs built above. Prepend
            # both so the link resolves instead of 404ing.
            signed_url = f"{self._base_url}/storage/v1{signed_url}"
        return SignedUrl(url=signed_url, expires_in=ttl)

    async def remove_object(self, key: str) -> None:
        key = _validate_object_key(key)
        try:
            async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
                response = await client.request(
                    "DELETE",
                    _bucket_url(self._base_url),
                    headers=_service_headers("application/json"),
                    json={"prefixes": [key]},
                )
        except httpx.HTTPError as exc:
            _raise_storage_transport_error("remove_object", exc)
        if response.status_code not in {200, 204}:
            _raise_storage_response_error("remove_object", response)


def _extract_signed_url(payload: dict[str, Any]) -> str:
    value = payload.get("signedURL") or payload.get("signedUrl") or payload.get("url")
    if not isinstance(value, str) or not value:
        raise StorageError("Storage sign_url response did not include a signed URL.")
    return value


async def put_object(key: str, content: bytes, content_type: str) -> None:
    await SupabaseStorageClient().put_object(key, content, content_type)


async def sign_url(key: str, ttl: int = DEFAULT_SIGNED_URL_TTL_SECONDS) -> SignedUrl:
    return await SupabaseStorageClient().sign_url(key, ttl)


async def remove_object(key: str) -> None:
    await SupabaseStorageClient().remove_object(key)
