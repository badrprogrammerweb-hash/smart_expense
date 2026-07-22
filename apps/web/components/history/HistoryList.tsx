"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";

import type { ActivityHistoryItem } from "@/lib/api/history";
import { supportedCurrencies, type SupportedCurrency } from "@/lib/currency";
import { toDisplayAmount } from "@/lib/money";
import { DateDisplay, MobileRecordCard } from "@/components/ui";

type HistoryListProps = {
  items: ActivityHistoryItem[];
  locale: string;
};

function summaryText(summary: Record<string, unknown>) {
  const merchantName = summary.merchant_name;
  const name = summary.name;
  const setting = summary.setting;
  const provider = summary.provider;

  if (typeof merchantName === "string" && merchantName.trim()) {
    return merchantName;
  }
  if (typeof name === "string" && name.trim()) {
    return name;
  }
  if (typeof setting === "string" && setting.trim()) {
    return setting;
  }
  if (typeof provider === "string" && provider.trim()) {
    return provider;
  }
  return null;
}

function summaryAmount(summary: Record<string, unknown>) {
  const amountMinor = summary.amount_minor;
  const currency = summary.currency;

  if (
    typeof amountMinor === "number" &&
    Number.isFinite(amountMinor) &&
    typeof currency === "string" &&
    supportedCurrencies.includes(currency as SupportedCurrency)
  ) {
    return { amountMinor, currency: currency as SupportedCurrency };
  }

  return null;
}

export function HistoryList({ items, locale }: HistoryListProps) {
  const t = useTranslations("history");
  const events = useTranslations("history.events");

  return (
    <section className="rounded-[var(--radius-card)] border bg-card text-card-foreground shadow-[var(--shadow-card)]">
      <ul className="hidden divide-y md:block">
        {items.map((item) => {
          const detail = summaryText(item.summary);
          const amount = summaryAmount(item.summary);

          return (
            <li className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between" key={item.id}>
              <div className="min-w-0">
                <p className="text-sm font-medium">{events(item.event_type)}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {item.actor_display_name ?? t("unknownActor")}
                  {detail ? ` - ${detail}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1 text-xs text-muted-foreground sm:items-end">
                {amount && (
                  <p className="text-sm font-semibold text-card-foreground">
                    {toDisplayAmount(amount.amountMinor, locale, amount.currency)}
                  </p>
                )}
                <p className="inline-flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <DateDisplay date={item.created_at} />
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="grid gap-3 p-4 md:hidden">
        {items.map((item) => {
          const detail = summaryText(item.summary);
          const amount = summaryAmount(item.summary);
          return <MobileRecordCard key={item.id} title={events(item.event_type)} fields={[{ label: t("actor"), value: item.actor_display_name ?? t("unknownActor") }, { label: t("date"), value: <DateDisplay date={item.created_at} /> }, ...(detail ? [{ label: t("details"), value: detail }] : []), ...(amount ? [{ label: t("amount"), value: toDisplayAmount(amount.amountMinor, locale, amount.currency) }] : [])]} />;
        })}
      </div>
    </section>
  );
}
