from datetime import date
from enum import StrEnum

from pydantic import BaseModel, ConfigDict

from app.schemas.reports import ReportPreset


class AiSummaryLocale(StrEnum):
    EN = "en"
    AR = "ar"


class AiSummaryRequest(BaseModel):
    period: ReportPreset = ReportPreset.CURRENT_MONTH
    start: date | None = None
    end: date | None = None
    locale: AiSummaryLocale

    model_config = ConfigDict(extra="forbid")


class AiSummaryResponse(BaseModel):
    locale: AiSummaryLocale
    text: str


class AiSummaryFailure(BaseModel):
    code: str
    message: str
