"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { useCategories } from "@/hooks/use-categories";
import type { SpendingSummary } from "@/lib/api/reports";
import { getCategoryLabel } from "@/lib/i18n/category-labels";
import { toDisplayAmount } from "@/lib/money";

type PlainLanguageSummaryProps = {
  summary: SpendingSummary;
  locale: string;
  workspaceId: string;
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

export function PlainLanguageSummary({ summary, locale, workspaceId }: PlainLanguageSummaryProps) {
  const t = useTranslations("summary");
  const dashboardT = useTranslations("dashboard");
  const catalogT = useTranslations("categories.catalog");
  const dir = locale === "ar" ? "rtl" : "ltr";
  // The report's `category_name` is the backend's stored (English) name. It has
  // to resolve through the same catalog the breakdown card below this sentence
  // uses, or the same category reads two different ways on one screen.
  const categories = useCategories(workspaceId, { categoryType: "expense", includeArchived: true });
  const categoriesById = useMemo(() => {
    const map = new Map<string, { name: string; translation_key: string | null }>();
    categories.data?.categories.forEach((main) => {
      map.set(main.id, main);
      main.subcategories.forEach((sub) => map.set(sub.id, sub));
    });
    return map;
  }, [categories.data?.categories]);

  function topCategoryLabel(topCategory: NonNullable<SpendingSummary["top_category"]>) {
    if (!topCategory.category_id) {
      return dashboardT("uncategorized");
    }

    const found = categoriesById.get(topCategory.category_id);
    return found ? getCategoryLabel(catalogT, found) : topCategory.category_name;
  }

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
                  category: topCategoryLabel(summary.top_category),
                })
              : t("noTopCategory")}
          </p>
          <p>{t(directionKey(summary.trend_direction))}</p>
        </div>
      )}
    </section>
  );
}
