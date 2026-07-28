"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { SupportReceiptView } from "@/components/settings/SupportReceiptView";
import { Badge, Button, ErrorState, Skeleton } from "@/components/ui";
import { DateDisplay, Ltr } from "@/components/ui/date-display";
import {
  listSupportPurchases,
  type SupportPurchase,
  type SupportPurchaseStatus,
} from "@/lib/api/support-purchases";
import { supportedCurrencies, type SupportedCurrency } from "@/lib/currency";
import { toDisplayAmount } from "@/lib/money";
import { nativeSupportBilling } from "@/lib/platform/capacitor";


const statusVariants: Record<
  SupportPurchaseStatus,
  "pending" | "income" | "expense" | "info"
> = {
  pending: "pending",
  completed: "income",
  failed: "expense",
  refunded: "info",
};

function displayAmount(purchase: SupportPurchase, locale: string) {
  return supportedCurrencies.includes(purchase.currency as SupportedCurrency)
    ? toDisplayAmount(
        purchase.amount_minor_units,
        locale,
        purchase.currency as SupportedCurrency,
      )
    : `${purchase.amount_minor_units} ${purchase.currency}`;
}

export function SupportPurchaseHistory() {
  const locale = useLocale();
  const t = useTranslations("supportPurchases");
  const common = useTranslations("common");
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(
    null,
  );
  const nativeBilling = nativeSupportBilling();
  const query = useQuery({
    queryKey: ["supportPurchases", "history"],
    queryFn: () =>
      nativeBilling
        ? nativeBilling.listHistory(listSupportPurchases)
        : listSupportPurchases(),
  });

  const statusLabel = (status: SupportPurchaseStatus) => {
    switch (status) {
      case "pending":
        return t("history.status.pending.label");
      case "completed":
        return t("history.status.completed.label");
      case "failed":
        return t("history.status.failed.label");
      case "refunded":
        return t("history.status.refunded.label");
    }
  };
  const statusDescription = (purchase: SupportPurchase) => {
    if (purchase.status === "failed") {
      switch (purchase.failure_reason) {
        case "checkout_expired":
          return t("failureReasons.checkoutExpired");
        case "payment_cancelled":
          return t("failureReasons.paymentCancelled");
        case "store_cancelled":
          return t("failureReasons.storeCancelled");
        case "store_failed":
          return t("failureReasons.storeFailed");
        default:
          return t("failureReasons.paymentFailed");
      }
    }
    switch (purchase.status) {
      case "pending":
        return t("history.status.pending.description");
      case "completed":
        return t("history.status.completed.description");
      case "refunded":
        return t("history.status.refunded.description");
    }
  };

  return (
    <section aria-labelledby="support-purchase-history-title" className="space-y-4">
      <div>
        <h2 id="support-purchase-history-title" className="text-xl font-semibold">
          {t("history.title")}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t("history.description")}
        </p>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-40 w-full" label={common("loading")} />
      ) : null}
      {query.isError ? (
        <ErrorState
          title={t("history.unavailableTitle")}
          description={t("history.unavailableDescription")}
          retry={() => void query.refetch()}
          retryLabel={common("retry")}
        />
      ) : null}
      {query.data?.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed p-6 text-center">
          <h3 className="font-semibold">{t("history.emptyTitle")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("history.emptyDescription")}
          </p>
        </div>
      ) : null}
      {query.data?.length ? (
        <ul className="space-y-3">
          {query.data.map((purchase) => (
            <li
              key={purchase.id}
              className="rounded-[var(--radius-card)] border bg-card p-4 shadow-[var(--shadow-card)]"
              data-status={purchase.status}
              data-testid="support-history-item"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{t(`tiers.${purchase.tier_id}`)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {statusDescription(purchase)}
                  </p>
                </div>
                <Badge variant={statusVariants[purchase.status]}>
                  {statusLabel(purchase.status)}
                </Badge>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">{t("history.amount")}</dt>
                  <dd className="mt-1 font-medium tabular-nums">
                    {displayAmount(purchase, locale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("history.date")}</dt>
                  <dd className="mt-1 font-medium">
                    <DateDisplay date={purchase.created_at} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("history.channel")}</dt>
                  <dd className="mt-1 font-medium">{t(`channels.${purchase.channel}`)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("history.reference")}</dt>
                  <dd className="mt-1 min-w-0 break-all text-sm">
                    {purchase.provider_reference ? (
                      <Ltr>{purchase.provider_reference}</Ltr>
                    ) : (
                      t("history.referencePrivate")
                    )}
                  </dd>
                </div>
              </dl>
              {purchase.status === "completed" ? (
                <div className="mt-4 border-t pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="compact"
                    aria-expanded={selectedReceiptId === purchase.id}
                    onClick={() =>
                      setSelectedReceiptId((current) =>
                        current === purchase.id ? null : purchase.id,
                      )
                    }
                  >
                    {t("history.receiptAction")}
                  </Button>
                </div>
              ) : null}
              {selectedReceiptId === purchase.id ? (
                <div className="mt-4">
                  <SupportReceiptView purchaseId={purchase.id} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
