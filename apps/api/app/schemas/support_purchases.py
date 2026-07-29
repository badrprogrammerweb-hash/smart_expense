"""API models for account-scoped support purchases."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class SupportTierResponse(BaseModel):
    tier_id: str
    label: str
    display_amount: str
    currency: str


class SupportTierListResponse(BaseModel):
    tiers: list[SupportTierResponse]


class CheckoutSessionRequest(BaseModel):
    tier_id: str = Field(min_length=1, max_length=100)
    locale: Literal["en", "ar"] = "en"


class CheckoutSessionResponse(BaseModel):
    purchase_id: UUID
    checkout_url: str


class MobilePurchaseVerifyRequest(BaseModel):
    tier_id: str = Field(min_length=1, max_length=100)
    channel: Literal["apple", "google"]
    provider_transaction_id: str = Field(min_length=1, max_length=4096)


class SupportPurchaseResponse(BaseModel):
    id: UUID
    tier_id: str
    channel: Literal["web", "ios", "android"]
    amount_minor_units: int
    currency: str
    status: Literal["pending", "completed", "failed", "refunded"]
    failure_reason: (
        Literal[
            "checkout_expired",
            "payment_cancelled",
            "payment_failed",
            "store_cancelled",
            "store_failed",
        ]
        | None
    )
    created_at: datetime
    updated_at: datetime
    provider_reference: str | None


class SupportPurchaseListResponse(BaseModel):
    purchases: list[SupportPurchaseResponse]


class SupportPurchaseReceiptResponse(BaseModel):
    id: UUID
    tier_id: str
    channel: Literal["web", "ios", "android"]
    amount_minor_units: int
    currency: str
    status: Literal["completed"]
    created_at: datetime
    provider_reference: str | None
    provider_receipt_url: str | None
