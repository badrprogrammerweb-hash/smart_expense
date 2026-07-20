from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


Locale = Literal["en", "ar"]


class UserProfile(BaseModel):
    id: UUID
    email: str
    display_name: str | None = None
    locale: Locale

    model_config = ConfigDict(from_attributes=True)


class LocaleUpdateRequest(BaseModel):
    locale: Locale

    model_config = ConfigDict(extra="forbid")


class LocaleUpdateResponse(BaseModel):
    id: UUID
    locale: Locale
