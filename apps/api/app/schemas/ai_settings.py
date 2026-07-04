from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, SecretStr


class AiProvider(StrEnum):
    GEMINI = "gemini"
    OPENAI = "openai"


class AiSettingsStatus(BaseModel):
    configured: bool
    provider: AiProvider | None = None
    masked_hint: str | None = None
    updated_at: datetime | None = None
    updated_by: UUID | None = None
    updated_by_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AiSettingsUpdateRequest(BaseModel):
    provider: AiProvider
    api_key: SecretStr

    model_config = ConfigDict(extra="forbid")


class AiSettingsError(BaseModel):
    code: str
    message: str
