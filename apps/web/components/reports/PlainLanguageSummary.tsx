"use client";

import { useTranslations } from "next-intl";

import type { SpendingSummary } from "@/lib/api/reports";
import { toDisplayAmount } from "@/lib/money";

type PlainLanguageSummaryProps = {
  summary: SpendingSummary;
  locale: string;
};

function directionKey(direction: SpendingSummary["trend_direction"]) {
  if (direction === "up") {
    return "trendUp";
  }
  if (direction === "down") {
    return "trendDown";
  }
  return "trendFlat";
}

export function PlainLanguageSummary({ summary, locale }: PlainLanguageSummaryProps) {
  const t = useTranslations("summary");
  const dir = locale === "ar" ? "rtl" : "ltr";
  const isEmpty =
    summary.total_income_minor === 0 &&
    summary.total_expenses_minor === 0 &&
    summary.remaining_balance_minor === 0 &&
    summary.top_category === null;

  return (
    <section className="rounded-[var(--radius-card)] border bg-card p-5 text-card-foreground shadow-[var(--shadow-card)]" dir={dir}>
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      {isEmpty ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
          <p>
            {t("totals", {
              expenses: toDisplayAmount(summary.total_expenses_minor, locale, summary.currency),
              income: toDisplayAmount(summary.total_income_minor, locale, summary.currency),
              remaining: toDisplayAmount(summary.remaining_balance_minor, locale, summary.currency),
            })}
          </p>
          <p>
            {summary.top_category
              ? t("topCategory", {
                  amount: toDisplayAmount(
                    summary.top_category.total_minor,
                    locale,
                    summary.top_category.currency,
                  ),
                  category: summary.top_category.category_name,
                })
              : t("noTopCategory")}
          </p>
          <p>{t(directionKey(summary.trend_direction))}</p>
        </div>
      )}
    </section>
  );
}
