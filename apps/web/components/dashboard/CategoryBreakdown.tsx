"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useCategories } from "@/hooks/use-categories";
import type { CategoryType } from "@/lib/api/categories";
import type { CategoryBreakdownItem } from "@/lib/api/dashboard";
import { getSubcategoryBreakdown, type ReportPeriodInput } from "@/lib/api/reports";
import { getCategoryLabel } from "@/lib/i18n/category-labels";
import { toDisplayAmount } from "@/lib/money";

export function CategoryBreakdown({
  items,
  locale,
  workspaceId,
  categoryType = "expense",
  period,
  title,
}: {
  items: CategoryBreakdownItem[];
  locale: string;
  workspaceId?: string;
  categoryType?: CategoryType;
  period?: ReportPeriodInput;
  title?: string;
}) {
  const t = useTranslations("dashboard");
  const common = useTranslations("common");
  const catalogT = useTranslations("categories.catalog");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const canDrillDown = Boolean(workspaceId && period);

  const categories = useCategories(workspaceId ?? "", { categoryType, includeArchived: true });
  const labelsById = useMemo(() => {
    const map = new Map<string, { name: string; translation_key: string | null }>();
    categories.data?.categories.forEach((main) => {
      map.set(main.id, main);
      main.subcategories.forEach((sub) => map.set(sub.id, sub));
    });
    return map;
  }, [categories.data?.categories]);

  function labelFor(id: string, fallbackName: string) {
    const found = labelsById.get(id);
    return found ? getCategoryLabel(catalogT, found) : fallbackName;
  }

  const drilldown = useQuery({
    queryKey: ["category-subcategory-breakdown", workspaceId, expandedId, period],
    queryFn: () => getSubcategoryBreakdown(workspaceId!, expandedId!, period!),
    enabled: Boolean(canDrillDown && expandedId),
  });

  function toggleExpanded(categoryId: string | null) {
    if (!categoryId || !canDrillDown) {
      return;
    }
    setExpandedId((current) => (current === categoryId ? null : categoryId));
  }

  return (
    <section className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <h2 className="text-lg font-semibold">{title ?? t("categoryBreakdown")}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("emptyDescription")}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => {
            const isExpanded = canDrillDown && expandedId === item.category_id;

            return (
              <li key={item.category_id ?? "uncategorized"}>
                <button
                  className="flex w-full items-center justify-between gap-4 text-left disabled:cursor-default"
                  disabled={!canDrillDown || !item.category_id}
                  onClick={() => toggleExpanded(item.category_id)}
                  type="button"
                >
                  <span className="flex items-center gap-1 text-sm">
                    {canDrillDown && item.category_id ? (
                      isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      )
                    ) : null}
                    {item.category_id ? labelFor(item.category_id, item.category_name) : t("uncategorized")}
                  </span>
                  <span className="text-sm font-semibold">
                    {toDisplayAmount(item.total_minor, locale, item.currency)}
                  </span>
                </button>
                {isExpanded && (
                  <ul className="mt-2 space-y-2 border-l pl-4 rtl:border-l-0 rtl:border-r rtl:pl-0 rtl:pr-4">
                    {drilldown.isLoading && <li className="text-xs text-muted-foreground">{common("loading")}</li>}
                    {drilldown.data?.subcategory_breakdown.map((sub) => (
                      <li
                        className="flex items-center justify-between gap-4"
                        key={sub.subcategory_id ?? "no-subcategory"}
                      >
                        <span className="text-xs text-muted-foreground">
                          {sub.subcategory_id
                            ? labelFor(sub.subcategory_id, sub.subcategory_name)
                            : catalogT("noSubcategory")}
                        </span>
                        <span className="text-xs font-medium">
                          {toDisplayAmount(sub.total_minor, locale, sub.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
