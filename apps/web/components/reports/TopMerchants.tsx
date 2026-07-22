"use client";

import { Store } from "lucide-react";
import { useTranslations } from "next-intl";

import type { MerchantTotal } from "@/lib/api/reports";
import { toDisplayAmount } from "@/lib/money";
import { MobileRecordCard } from "@/components/ui";

type TopMerchantsProps = {
  merchants: MerchantTotal[];
  locale: string;
};

export function TopMerchants({ merchants, locale }: TopMerchantsProps) {
  const t = useTranslations("reports.topMerchants");

  return (
    <section className="rounded-[var(--radius-card)] border bg-card p-5 text-card-foreground shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2">
        <Store className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-semibold">{t("title")}</h2>
      </div>
      {merchants.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (<>
        <ul className="mt-4 hidden divide-y md:block">
          {merchants.map((merchant) => (
            <li className="flex items-center justify-between gap-4 py-3" key={merchant.merchant_name}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{merchant.merchant_name}</p>
                <p className="text-xs text-muted-foreground">{merchant.count}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold">
                {toDisplayAmount(merchant.total_minor, locale, merchant.currency)}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-3 md:hidden">
          {merchants.map((merchant) => <MobileRecordCard key={merchant.merchant_name} title={merchant.merchant_name} fields={[{ label: t("count"), value: merchant.count }, { label: t("total"), value: toDisplayAmount(merchant.total_minor, locale, merchant.currency) }]} />)}
        </div>
      </>)}
    </section>
  );
}
