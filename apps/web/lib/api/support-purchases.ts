import type { Locale } from "@/i18n/routing";

import { apiFetch } from "./client";


export type SupportTier = {
  tier_id: "support_small" | "support_medium" | "support_large";
  label: string;
  display_amount: string;
  currency: string;
};

export type SupportPurchaseStatus = "pending" | "completed" | "failed" | "refunded";
export type SupportPurchaseChannel = "web" | "ios" | "android";
export type SupportPurchaseFailureReason =
  | "checkout_expired"
  | "payment_cancelled"
  | "payment_failed"
  | "store_cancelled"
  | "store_failed";

export type SupportPurchase = {
  id: string;
  tier_id: string;
  channel: SupportPurchaseChannel;
  amount_minor_units: number;
  currency: string;
  status: SupportPurchaseStatus;
  failure_reason: SupportPurchaseFailureReason | null;
  created_at: string;
  updated_at: string;
  provider_reference: string | null;
};

export type SupportPurchaseReceipt = {
  id: string;
  tier_id: string;
  channel: SupportPurchaseChannel;
  amount_minor_units: number;
  currency: string;
  status: "completed";
  created_at: string;
  provider_reference: string | null;
  provider_receipt_url: string | null;
};

const SAFE_PROVIDER_RECEIPT_HOSTS = new Set([
  "pay.stripe.com",
  "dashboard.stripe.com",
  "reportaproblem.apple.com",
  "apps.apple.com",
  "play.google.com",
  "payments.google.com",
]);

export function isSafeProviderReceiptUrl(
  value: string | null | undefined,
): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.port === "" &&
      SAFE_PROVIDER_RECEIPT_HOSTS.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

export type MobileSupportPurchaseVerifyRequest = {
  tier_id: SupportTier["tier_id"];
  channel: "apple" | "google";
  provider_transaction_id: string;
};

export async function listSupportTiers() {
  const response = await apiFetch<{ tiers: SupportTier[] }>("/support-purchases/tiers");
  return response.tiers;
}

export async function startSupportCheckout(tierId: SupportTier["tier_id"], locale: Locale) {
  return apiFetch<{ purchase_id: string; checkout_url: string }>(
    "/support-purchases/checkout-sessions",
    {
      method: "POST",
      body: JSON.stringify({ tier_id: tierId, locale }),
    },
  );
}

export async function getWebSupportPurchase(checkoutSessionId: string) {
  return apiFetch<SupportPurchase>(
    `/support-purchases/session/${encodeURIComponent(checkoutSessionId)}`,
  );
}

export async function verifyMobileSupportPurchase(
  request: MobileSupportPurchaseVerifyRequest,
) {
  return apiFetch<SupportPurchase>("/support-purchases/mobile/verify", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function listSupportPurchases() {
  const response = await apiFetch<{ purchases: SupportPurchase[] }>(
    "/support-purchases",
  );
  return response.purchases;
}

export async function getSupportPurchaseReceipt(purchaseId: string) {
  return apiFetch<SupportPurchaseReceipt>(
    `/support-purchases/${encodeURIComponent(purchaseId)}/receipt`,
  );
}
