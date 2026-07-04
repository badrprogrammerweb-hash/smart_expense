"""Direct REST calls to the Gemini and OpenAI provider APIs.

The one place the decrypted BYOK key touches an outbound HTTP call
(research.md Decision 4), mirroring how `services/storage.py` isolates the
one place the service-role key touches object bytes. No vendor SDK is
added; both providers are called over the already-present `httpx` client.

Model identifiers are an implementation detail (research.md Decision 4's
implementer note), not a spec/plan decision, and can be retuned without
changing any functional requirement.
"""

from __future__ import annotations

import base64
from datetime import date

import httpx
from pydantic import BaseModel, ValidationError

from app.schemas.ai_settings import AiProvider
from app.schemas.extractions import FailureReason


PROVIDER_TIMEOUT_SECONDS = 45

GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_ENDPOINT = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)

OPENAI_MODEL = "gpt-4o-mini"
OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions"

EXTRACTION_PROMPT = (
    "Extract the transaction amount in the smallest currency unit "
    "(amount_minor), the ISO currency code (currency), the transaction date "
    "as YYYY-MM-DD (occurred_on), the vendor or merchant name (vendor_name), "
    "and a short spending category suggestion (suggested_category) from this "
    "receipt or invoice. Respond with a field left null if it cannot be "
    "determined."
)

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "amount_minor": {"type": ["integer", "null"]},
        "currency": {"type": ["string", "null"]},
        "occurred_on": {"type": ["string", "null"]},
        "vendor_name": {"type": ["string", "null"]},
        "suggested_category": {"type": ["string", "null"]},
    },
}


class ExtractedFields(BaseModel):
    """Strictly-parsed provider output (research.md Decision 5): every field
    is optional, and a response that does not even parse into this shape is
    a `malformed_response` failure, never a partially-trusted draft."""

    amount_minor: int | None = None
    currency: str | None = None
    occurred_on: date | None = None
    vendor_name: str | None = None
    suggested_category: str | None = None


class ExtractionFailure(BaseModel):
    failure_reason: FailureReason


def _classify_http_error(status_code: int) -> FailureReason:
    if status_code in (401, 403):
        return FailureReason.INVALID_KEY
    if status_code == 429:
        return FailureReason.RATE_LIMITED
    return FailureReason.PROVIDER_ERROR


def _parse_extracted_fields(raw_text: str) -> ExtractedFields | ExtractionFailure:
    try:
        return ExtractedFields.model_validate_json(raw_text)
    except ValidationError:
        return ExtractionFailure(failure_reason=FailureReason.MALFORMED_RESPONSE)


async def _extract_gemini(
    api_key: str, file_bytes: bytes, content_type: str
) -> ExtractedFields | ExtractionFailure:
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": EXTRACTION_PROMPT},
                    {
                        "inline_data": {
                            "mime_type": content_type,
                            "data": base64.b64encode(file_bytes).decode("ascii"),
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=PROVIDER_TIMEOUT_SECONDS, trust_env=False) as client:
            # The key goes in a header, never the URL/query string: a URL is
            # far more likely to end up logged (request logging, exception
            # tracebacks) than a header (research.md Decisions 1-3).
            response = await client.post(
                GEMINI_ENDPOINT, headers={"x-goog-api-key": api_key}, json=payload
            )
    except httpx.HTTPError:
        # Covers both an exceeded timeout and a connection error
        # (research.md Decision 6 groups both under `timeout`).
        return ExtractionFailure(failure_reason=FailureReason.TIMEOUT)

    if response.status_code != 200:
        return ExtractionFailure(failure_reason=_classify_http_error(response.status_code))

    try:
        body = response.json()
        raw_text = body["candidates"][0]["content"]["parts"][0]["text"]
    except (ValueError, KeyError, IndexError, TypeError):
        return ExtractionFailure(failure_reason=FailureReason.MALFORMED_RESPONSE)

    return _parse_extracted_fields(raw_text)


async def _extract_openai(
    api_key: str, file_bytes: bytes, content_type: str
) -> ExtractedFields | ExtractionFailure:
    encoded = base64.b64encode(file_bytes).decode("ascii")
    data_url = f"data:{content_type};base64,{encoded}"
    if content_type == "application/pdf":
        file_part: dict[str, object] = {"type": "input_file", "file_data": data_url}
    else:
        file_part = {"type": "image_url", "image_url": {"url": data_url}}

    payload = {
        "model": OPENAI_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": EXTRACTION_PROMPT},
                    file_part,
                ],
            }
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": "extracted_fields", "schema": RESPONSE_SCHEMA},
        },
    }
    try:
        async with httpx.AsyncClient(timeout=PROVIDER_TIMEOUT_SECONDS, trust_env=False) as client:
            response = await client.post(
                OPENAI_ENDPOINT,
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
    except httpx.HTTPError:
        # Covers both an exceeded timeout and a connection error
        # (research.md Decision 6 groups both under `timeout`).
        return ExtractionFailure(failure_reason=FailureReason.TIMEOUT)

    if response.status_code != 200:
        return ExtractionFailure(failure_reason=_classify_http_error(response.status_code))

    try:
        body = response.json()
        raw_text = body["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError):
        return ExtractionFailure(failure_reason=FailureReason.MALFORMED_RESPONSE)

    return _parse_extracted_fields(raw_text)


async def extract_receipt(
    provider: AiProvider,
    api_key: str,
    file_bytes: bytes,
    content_type: str,
) -> ExtractedFields | ExtractionFailure:
    """Call the workspace's configured provider and return either a strictly
    parsed draft or a classified, safe failure. Never raises for a provider
    or parsing failure; the decrypted `api_key` is used only as a bound
    parameter of this one outbound request and is never logged or returned
    (research.md Decisions 3, 6)."""

    if provider is AiProvider.GEMINI:
        return await _extract_gemini(api_key, file_bytes, content_type)
    return await _extract_openai(api_key, file_bytes, content_type)
