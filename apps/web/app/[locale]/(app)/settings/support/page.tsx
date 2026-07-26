"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { SupportTierSelector } from "@/components/settings/SupportTierSelector";
import { ErrorState, PageHeading, Skeleton } from "@/components/ui";
import { isLocale } from "@/i18n/routing";
import { listSupportTiers } from "@/lib/api/support-purchases";


export default function SupportPurchasePage() {
  const localeValue = useLocale();
  const locale = isLocale(localeValue) ? localeValue : "en";
  const t = useTranslations("supportPurchases");
  const common = useTranslations("common");
  const query = useQuery({
    queryKey: ["supportPurchases", "tiers"],
    queryFn: listSupportTiers,
    staleTime: 5 * 60_000,
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeading title={t("pageTitle")} description={t("pageDescription")} />
      {query.isLoading ? (
        <Skeleton className="h-64 w-full" label={common("loading")} />
      ) : null}
      {query.isError ? (
        <ErrorState
          title={t("tiersUnavailableTitle")}
          description={t("tiersUnavailableDescription")}
          retry={() => void query.refetch()}
          retryLabel={common("retry")}
        />
      ) : null}
      {query.data ? <SupportTierSelector locale={locale} tiers={query.data} /> : null}
    </main>
  );
}
