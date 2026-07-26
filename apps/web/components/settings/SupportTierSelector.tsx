"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";
import {
  startSupportCheckout,
  type SupportTier,
} from "@/lib/api/support-purchases";
import { cn } from "@/lib/utils";


type SupportTierSelectorProps = {
  locale: Locale;
  tiers: SupportTier[];
};

function isStripeHostedCheckout(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.stripe.com";
  } catch {
    return false;
  }
}

export function SupportTierSelector({ locale, tiers }: SupportTierSelectorProps) {
  const t = useTranslations("supportPurchases");
  const [selectedTierId, setSelectedTierId] = useState<SupportTier["tier_id"] | null>(
    tiers[0]?.tier_id ?? null,
  );
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTier = tiers.find((tier) => tier.tier_id === selectedTierId) ?? null;

  async function continueToStripe() {
    if (!selectedTier || isRedirecting) return;
    setError(null);
    setIsRedirecting(true);
    try {
      const checkout = await startSupportCheckout(selectedTier.tier_id, locale);
      if (!isStripeHostedCheckout(checkout.checkout_url)) {
        throw new Error("Unexpected checkout destination.");
      }
      window.location.assign(checkout.checkout_url);
    } catch {
      setError(t("checkoutError"));
      setIsRedirecting(false);
    }
  }

  return (
    <section
      aria-labelledby="support-tier-heading"
      className="rounded-[var(--radius-card)] border bg-card p-6 shadow-[var(--shadow-card)]"
    >
      <h2 id="support-tier-heading" className="text-lg font-semibold">
        {t("selectTier")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("selectTierDescription")}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3" role="group" aria-label={t("selectTier")}>
        {tiers.map((tier) => {
          const selected = tier.tier_id === selectedTierId;
          return (
            <button
              key={tier.tier_id}
              aria-pressed={selected}
              className={cn(
                "min-h-28 rounded-[var(--radius-control)] border p-4 text-start transition focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
                selected
                  ? "border-primary bg-primary/5"
                  : "bg-background hover:bg-[var(--color-surface-hover)]",
              )}
              onClick={() => setSelectedTierId(tier.tier_id)}
              type="button"
            >
              <span className="block text-sm font-medium">
                {t(`tiers.${tier.tier_id}`)}
              </span>
              <span className="mt-3 block text-xl font-semibold tabular-nums" dir="ltr">
                {tier.display_amount} {tier.currency}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-sm text-muted-foreground">{t("hostedCheckoutNote")}</p>
      {error ? (
        <p className="mt-3 text-sm text-expense" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        className="mt-5 w-full sm:w-auto"
        disabled={!selectedTier}
        loading={isRedirecting}
        loadingLabel={t("redirecting")}
        onClick={() => void continueToStripe()}
        type="button"
      >
        {t("continueAction")}
      </Button>
    </section>
  );
}
