"""Static, server-owned support-purchase tier configuration."""

from dataclasses import dataclass


@dataclass(frozen=True)
class SupportTier:
    """A fixed support tier and its provider-specific product identifiers."""

    id: str
    label: str
    amount_minor_units: int
    currency: str
    stripe_price_id: str
    apple_product_id: str
    google_product_id: str


SUPPORT_TIERS = (
    SupportTier(
        id="support_small",
        label="Small support",
        amount_minor_units=500,
        currency="SAR",
        stripe_price_id="price_support_small",
        apple_product_id="ai.smartexpense.support.small",
        google_product_id="ai.smartexpense.support.small",
    ),
    SupportTier(
        id="support_medium",
        label="Medium support",
        amount_minor_units=1500,
        currency="SAR",
        stripe_price_id="price_support_medium",
        apple_product_id="ai.smartexpense.support.medium",
        google_product_id="ai.smartexpense.support.medium",
    ),
    SupportTier(
        id="support_large",
        label="Large support",
        amount_minor_units=5000,
        currency="SAR",
        stripe_price_id="price_support_large",
        apple_product_id="ai.smartexpense.support.large",
        google_product_id="ai.smartexpense.support.large",
    ),
)
