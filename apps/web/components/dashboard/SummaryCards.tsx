"use client";

import { CalendarDays, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { useTranslations } from "next-intl";

import type { DashboardPeriod, DashboardSummary } from "@/lib/api/dashboard";
import { toDisplayAmount } from "@/lib/money";
import { InfoCard, SummaryCard } from "@/components/ui";

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

  const remaining = cards[2];
  const supportingCards = [cards[0], cards[1], cards[3]];

  return (
    <section aria-label={t("title")} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.25fr)_repeat(2,minmax(0,1fr))]">
        <SummaryCard label={remaining.label} value={remaining.value} detail={remaining.tone === "negative" ? <span className="text-expense-foreground">{remaining.label}</span> : undefined} />
        {supportingCards.map((card) => {
          const Icon = card.icon;

          return (
            <InfoCard key={card.label} title={card.label} value={<span className="inline-flex items-center gap-2"><Icon className="size-4 text-muted-foreground" aria-hidden="true" />{card.value}</span>} />
          );
        })}
      </div>
      {isEmpty && (
        <p className="rounded-[var(--radius-card)] border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">{t("emptyDescription")}</p>
      )}
    </section>
  );
}
