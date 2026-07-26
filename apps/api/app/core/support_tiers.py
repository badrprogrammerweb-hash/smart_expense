"""Static, server-owned support-purchase tier configuration."""

from dataclasses import dataclass


@dataclass(frozen=True)
class SupportTier:
    """A fixed support tier and its provider-specific product identifiers."""

    id: str
    label: str
    stripe_price_id: str
    apple_product_id: str
    google_product_id: str


SUPPORT_TIERS = (
    SupportTier(
        id="support_small",
        label="Small support",
        stripe_price_id="price_support_small",
        apple_product_id="ai.smartexpense.support.small",
        google_product_id="ai.smartexpense.support.small",
    ),
    SupportTier(
        id="support_medium",
        label="Medium support",
        stripe_price_id="price_support_medium",
        apple_product_id="ai.smartexpense.support.medium",
        google_product_id="ai.smartexpense.support.medium",
    ),
    SupportTier(
        id="support_large",
        label="Large support",
        stripe_price_id="price_support_large",
        apple_product_id="ai.smartexpense.support.large",
        google_product_id="ai.smartexpense.support.large",
    ),
)
