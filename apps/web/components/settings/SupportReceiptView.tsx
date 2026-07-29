"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { Button, ErrorState, Skeleton } from "@/components/ui";
import { DateDisplay, Ltr } from "@/components/ui/date-display";
import { ApiError } from "@/lib/api/client";
import {
  getSupportPurchaseReceipt,
  isSafeProviderReceiptUrl,
  type SupportPurchaseReceipt,
} from "@/lib/api/support-purchases";
import { supportedCurrencies, type SupportedCurrency } from "@/lib/currency";
import { toDisplayAmount } from "@/lib/money";
import { nativeSupportBilling } from "@/lib/platform/capacitor";


function displayAmount(receipt: SupportPurchaseReceipt, locale: string) {
  return supportedCurrencies.includes(receipt.currency as SupportedCurrency)
    ? toDisplayAmount(
        receipt.amount_minor_units,
        locale,
        receipt.currency as SupportedCurrency,
      )
    : `${receipt.amount_minor_units} ${receipt.currency}`;
}

export function SupportReceiptView({ purchaseId }: { purchaseId: string }) {
  const locale = useLocale();
  const t = useTranslations("supportPurchases");
  const common = useTranslations("common");
  const nativeBilling = nativeSupportBilling();
  const query = useQuery({
    queryKey: ["supportPurchases", "receipt", purchaseId],
    queryFn: () =>
      nativeBilling
        ? nativeBilling.getReceipt(
            purchaseId,
            getSupportPurchaseReceipt,
          )
        : getSupportPurchaseReceipt(purchaseId),
  });

  if (query.isLoading) {
    return (
      <section data-testid="support-receipt-view">
        <Skeleton className="h-48 w-full" label={common("loading")} />
      </section>
    );
  }

  if (query.isError) {
    const denied =
      query.error instanceof ApiError && query.error.status === 404;
    return (
      <section data-testid="support-receipt-view">
        {denied ? (
          <ErrorState
            title={t("receipt.notAvailableTitle")}
            description={t("receipt.notAvailableDescription")}
          />
        ) : (
          <ErrorState
            title={t("receipt.unavailableTitle")}
            description={t("receipt.unavailableDescription")}
            retry={() => void query.refetch()}
            retryLabel={common("retry")}
          />
        )}
      </section>
    );
  }

  const receipt = query.data;
  if (!receipt) return null;

  const receiptUrl = isSafeProviderReceiptUrl(
    receipt.provider_receipt_url,
  )
    ? receipt.provider_receipt_url
    : null;

  return (
    <section
      aria-labelledby={`support-receipt-title-${receipt.id}`}
      className="rounded-[var(--radius-card)] border bg-card p-5 shadow-[var(--shadow-card)]"
      data-testid="support-receipt-view"
    >
      <div>
        <h3
          id={`support-receipt-title-${receipt.id}`}
          className="text-lg font-semibold"
        >
          {t("receipt.title")}
        </h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t("receipt.description")}
        </p>
      </div>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">{t("receipt.tier")}</dt>
          <dd className="mt-1 font-medium">{t(`tiers.${receipt.tier_id}`)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("receipt.amount")}</dt>
          <dd className="mt-1 font-medium tabular-nums">
            {displayAmount(receipt, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("receipt.date")}</dt>
          <dd className="mt-1 font-medium">
            <DateDisplay date={receipt.created_at} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("receipt.channel")}</dt>
          <dd className="mt-1 font-medium">
            {t(`channels.${receipt.channel}`)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("receipt.status")}</dt>
          <dd className="mt-1 font-medium">
            {t("history.status.completed.label")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("receipt.reference")}</dt>
          <dd className="mt-1 min-w-0 break-all">
            {receipt.provider_reference ? (
              <Ltr>{receipt.provider_reference}</Ltr>
            ) : (
              t("history.referencePrivate")
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5 border-t pt-4">
        {receiptUrl ? (
          nativeBilling ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void nativeBilling.openReceipt(receiptUrl)}
            >
              {t("receipt.providerLink")}
            </Button>
          ) : (
            <a
              className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-4 py-2 text-sm font-medium text-primary underline underline-offset-4"
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("receipt.providerLink")}
            </a>
          )
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("receipt.providerLinkUnavailable")}
          </p>
        )}
      </div>
    </section>
  );
}
