"use client";

import { CalendarDays, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { useTranslations } from "next-intl";

import type { DashboardPeriod, DashboardSummary } from "@/lib/api/dashboard";
import { toDisplayAmount } from "@/lib/money";

type SummaryCardsProps = {
  summary: DashboardSummary;
  period: DashboardPeriod;
  locale: string;
};

export function SummaryCards({ summary, period, locale }: SummaryCardsProps) {
  const t = useTranslations("dashboard");
  const cards = [
    {
      label: t("totalIncome"),
      value: toDisplayAmount(summary.total_income_minor, locale, summary.currency),
      icon: TrendingUp,
    },
    {
      label: t("totalExpenses"),
      value: toDisplayAmount(summary.total_expenses_minor, locale, summary.currency),
      icon: TrendingDown,
    },
    {
      label: t("remainingBalance"),
      value: toDisplayAmount(summary.remaining_balance_minor, locale, summary.currency),
      icon: WalletCards,
      tone: summary.remaining_balance_minor < 0 ? "negative" : "default",
    },
    {
      label: t("period"),
      value: `${period.start} - ${period.end}`,
      icon: CalendarDays,
    },
  ];
  const isEmpty =
    summary.total_income_minor === 0 &&
    summary.total_expenses_minor === 0 &&
    summary.remaining_balance_minor === 0;

  return (
    <section aria-label={t("title")} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <article className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm" key={card.label}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <p
                className={
                  card.tone === "negative"
                    ? "mt-3 text-2xl font-semibold text-destructive"
                    : "mt-3 text-2xl font-semibold"
                }
              >
                {card.value}
              </p>
            </article>
          );
        })}
      </div>
      {isEmpty && (
        <p className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
          {t("emptyDescription")}
        </p>
      )}
    </section>
  );
}
