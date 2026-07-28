"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui";
import { isLocale } from "@/i18n/routing";
import { getWebSupportPurchase } from "@/lib/api/support-purchases";
import { supportedCurrencies, type SupportedCurrency } from "@/lib/currency";
import { DateDisplay, Ltr } from "@/components/ui/date-display";
import { toDisplayAmount } from "@/lib/money";


export function SupportPurchaseResult() {
  const localeValue = useLocale();
  const locale = isLocale(localeValue) ? localeValue : "en";
  const t = useTranslations("supportPurchases");
  const common = useTranslations("common");
  const searchParams = useSearchParams();
  const checkoutSessionId = searchParams.get("session_id") ?? "";
  const validReference = checkoutSessionId.startsWith("cs_");
  const query = useQuery({
    queryKey: ["supportPurchases", "web", checkoutSessionId],
    queryFn: () => getWebSupportPurchase(checkoutSessionId),
    enabled: validReference,
    refetchInterval: (state) =>
      state.state.data?.status === "pending" ? 1_500 : false,
  });

  const supportHref = `/${locale}/settings/support`;

  if (!validReference) {
    return (
      <ErrorState
        title={t("resultUnavailableTitle")}
        description={t("resultUnavailableDescription")}
      />
    );
  }
  if (query.isLoading) {
    return <Skeleton className="h-48 w-full" label={common("loading")} />;
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title={t("resultUnavailableTitle")}
        description={t("resultUnavailableDescription")}
        retry={() => void query.refetch()}
        retryLabel={common("retry")}
      />
    );
  }

  const purchase = query.data;
  const isCompleted = purchase.status === "completed";
  const isFailed = purchase.status === "failed";
  const isPending = purchase.status === "pending";
  const isRefunded = purchase.status === "refunded";
  const showsReceipt = isCompleted || isRefunded;
  const failedDescription = (() => {
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
  })();
  const displayAmount = supportedCurrencies.includes(
    purchase.currency as SupportedCurrency,
  )
    ? toDisplayAmount(
        purchase.amount_minor_units,
        locale,
        purchase.currency as SupportedCurrency,
      )
    : `${purchase.amount_minor_units} ${purchase.currency}`;

  return (
    <section
      aria-live="polite"
      className="rounded-[var(--radius-card)] border bg-card p-6 shadow-[var(--shadow-card)]"
      data-status={purchase.status}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        {t("eyebrow")}
      </p>
      <h1 className="mt-2 text-2xl font-semibold">
        {isCompleted
          ? t("completedTitle")
          : isRefunded
            ? t("refundedTitle")
            : isFailed
              ? t("failedTitle")
              : isPending
                ? t("pendingTitle")
                : t("resultUnavailableTitle")}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {isCompleted
          ? t("completedDescription")
          : isRefunded
            ? t("refundedDescription")
            : isFailed
              ? failedDescription
              : isPending
                ? t("pendingDescription")
                : t("resultUnavailableDescription")}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">{t("verifiedStateNote")}</p>

      {showsReceipt ? (
        <dl
          className="mt-6 grid gap-4 rounded-[var(--radius-control)] border bg-background p-4 sm:grid-cols-2"
          data-testid="support-purchase-receipt"
        >
          <div>
            <dt className="text-xs text-muted-foreground">{t("receipt.amount")}</dt>
            <dd className="mt-1 font-medium tabular-nums">{displayAmount}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("receipt.date")}</dt>
            <dd className="mt-1 font-medium">
              <DateDisplay date={purchase.created_at} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("receipt.channel")}</dt>
            <dd className="mt-1 font-medium">{t("receipt.webChannel")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("receipt.reference")}</dt>
            <dd className="mt-1 break-all text-sm">
              <Ltr>{purchase.provider_reference}</Ltr>
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {!isCompleted ? (
          <Link className={buttonVariants({ variant: "primary" })} href={supportHref}>
            {t("tryAgainAction")}
          </Link>
        ) : null}
        <Link
          className={buttonVariants({ variant: isCompleted ? "primary" : "secondary" })}
          href={`/${locale}`}
        >
          {t("returnAction")}
        </Link>
      </div>
    </section>
  );
}
