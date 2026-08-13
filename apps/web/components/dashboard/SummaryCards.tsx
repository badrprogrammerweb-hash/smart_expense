"use client";

import { CalendarDays, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { useTranslations } from "next-intl";

import type { DashboardPeriod, DashboardSummary } from "@/lib/api/dashboard";
import { formatDisplayDate } from "@/lib/format/date";
import { toDisplayAmount } from "@/lib/money";
import { InfoCard, SummaryCard } from "@/components/ui";

type SummaryCardsProps = {
  summary: DashboardSummary;
  period: DashboardPeriod;
  locale: string;
  /** Overrides the period card's title. Reports pass a label matching the
   *  selected preset; the dashboard always shows the current month (BUG-21). */
  periodLabel?: string;
};

export function SummaryCards({ summary, period, locale, periodLabel }: SummaryCardsProps) {
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
      label: periodLabel ?? t("period"),
      // Kept as a plain interpolated string rather than an LTR-isolated node:
      // the range is bidi-reordered by the browser, and the audit confirmed the
      // resulting RTL order is correct. `07/08/2026` and `2026-08-01` resolve
      // identically under UAX#9 (both `/` and `-` join digits into one number
      // run), so formatting changes the text without changing that ordering.
      value: `${formatDisplayDate(period.start)} - ${formatDisplayDate(period.end)}`,
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
        {/* The negative state used to repeat the card's own label in red
            beneath the figure, so the most important number on the screen read
            like a rendering fault and the emphasis said nothing (BUG-13). The
            slot now explains the deficit instead. */}
        <SummaryCard label={remaining.label} value={remaining.value} detail={remaining.tone === "negative" ? <span className="text-expense-foreground">{t("deficitNotice")}</span> : undefined} />
        {supportingCards.map((card) => {
          const Icon = card.icon;

          return (
            <InfoCard key={card.label} title={card.label} value={<span className="inline-flex items-center gap-2"><Icon className="size-4 text-muted-foreground" aria-hidden="true" />{card.value}</span>} />
          );
        })}
      </div>
      {isEmpty && (
        <p className="rounded-[var(--radius-card)] border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">{t("emptyPeriodHint", { start: formatDisplayDate(period.start), end: formatDisplayDate(period.end) })}</p>
      )}
    </section>
  );
}
