"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";
import {
  startSupportCheckout,
  verifyMobileSupportPurchase,
  type SupportPurchase,
  type SupportTier,
} from "@/lib/api/support-purchases";
import { getMe } from "@/lib/api/me";
import {
  isNative,
  nativeSupportBilling,
  type NativeSupportBillingAdapter,
  type NativeSupportBillingResult,
} from "@/lib/platform/capacitor";
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
  const [displayTiers, setDisplayTiers] = useState(tiers);
  const [selectedTierId, setSelectedTierId] = useState<SupportTier["tier_id"] | null>(
    tiers[0]?.tier_id ?? null,
  );
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [nativeRuntime, setNativeRuntime] = useState(false);
  const [billing, setBilling] = useState<NativeSupportBillingAdapter | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nativeResult, setNativeResult] =
    useState<NativeSupportBillingResult | null>(null);

  const selectedTier =
    displayTiers.find((tier) => tier.tier_id === selectedTierId) ?? null;

  useEffect(() => {
    let active = true;
    const insideNativeApp = isNative();
    const adapter = insideNativeApp ? nativeSupportBilling() : null;
    setNativeRuntime(insideNativeApp);
    setBilling(adapter);
    setRuntimeReady(true);
    if (adapter) {
      void adapter
        .listTiers(tiers)
        .then((localized) => {
          if (active) setDisplayTiers(localized);
        })
        .catch(() => {
          if (active) setError(t("nativeProductsError"));
        });
    }
    return () => {
      active = false;
    };
  }, [t, tiers]);

  async function continueToSupportPurchase() {
    if (!selectedTier || isRedirecting) return;
    setError(null);
    setNativeResult(null);
    setIsRedirecting(true);
    try {
      if (nativeRuntime) {
        if (!billing) {
          throw new Error("Native store billing is unavailable.");
        }
        const profile = await getMe();
        const result = await billing.purchase({
          tier_id: selectedTier.tier_id,
          account_id: profile.id,
          verify: (request) => verifyMobileSupportPurchase(request),
        });
        setNativeResult(result);
        setIsRedirecting(false);
        return;
      }
      const checkout = await startSupportCheckout(selectedTier.tier_id, locale);
      if (!isStripeHostedCheckout(checkout.checkout_url)) {
        throw new Error("Unexpected checkout destination.");
      }
      window.location.assign(checkout.checkout_url);
    } catch {
      setError(nativeRuntime ? t("nativeFailed") : t("checkoutError"));
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
        {displayTiers.map((tier) => {
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
                {tier.display_amount}
                {billing ? "" : ` ${tier.currency}`}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-sm text-muted-foreground">
        {nativeRuntime ? t("nativeBillingNote") : t("hostedCheckoutNote")}
      </p>
      {error ? (
        <p className="mt-3 text-sm text-expense" role="alert">
          {error}
        </p>
      ) : null}
      {nativeResult ? (
        <NativeSupportPurchaseState result={nativeResult} />
      ) : null}
      <Button
        className="mt-5 w-full sm:w-auto"
        disabled={!selectedTier || !runtimeReady}
        loading={isRedirecting}
        loadingLabel={nativeRuntime ? t("nativeProcessing") : t("redirecting")}
        onClick={() => void continueToSupportPurchase()}
        type="button"
      >
        {nativeRuntime ? t("nativeContinueAction") : t("continueAction")}
      </Button>
    </section>
  );
}

function formattedAmount(
  purchase: SupportPurchase,
  locale: string,
): string {
  const currencyOptions = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: purchase.currency,
  }).resolvedOptions();
  const fractionDigits = currencyOptions.maximumFractionDigits ?? 2;
  const amount = new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(purchase.amount_minor_units / 10 ** fractionDigits);
  return `${amount} ${purchase.currency}`;
}

function NativeSupportPurchaseState({
  result,
}: {
  result: NativeSupportBillingResult;
}) {
  const t = useTranslations("supportPurchases");
  const locale = useLocale();
  const purchase = result.purchase as SupportPurchase | undefined;

  if (result.status === "completed") {
    return purchase ? (
      <div
        className="mt-4 rounded-[var(--radius-control)] border border-primary/30 bg-primary/5 p-4 text-sm"
        data-testid="native-support-receipt"
        role="status"
      >
        <p className="font-semibold">{t("nativeCompleted")}</p>
        <p className="mt-1 text-muted-foreground">
          {formattedAmount(purchase, locale)} · {t(`channels.${purchase.channel}`)}
        </p>
      </div>
    ) : (
      <p className="mt-4 text-sm text-expense" role="alert">
        {t("nativeFailed")}
      </p>
    );
  }

  if (result.status === "pending") {
    return (
      <p className="mt-4 text-sm text-muted-foreground" role="status">
        {t("nativePending")}
      </p>
    );
  }

  return (
    <p className="mt-4 text-sm text-expense" role="alert">
      {result.reason === "cancelled"
        ? t("nativeCancelled")
        : result.reason === "refunded"
          ? t("nativeRefunded")
          : t("nativeFailed")}
    </p>
  );
}
