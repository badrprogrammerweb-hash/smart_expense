"use client";

import { useTranslations } from "next-intl";

import type { CategoryBreakdownItem } from "@/lib/api/dashboard";
import { toDisplayAmount } from "@/lib/money";

export function CategoryBreakdown({
  items,
  locale,
}: {
  items: CategoryBreakdownItem[];
  locale: string;
}) {
  const t = useTranslations("dashboard");

  return (
    <section className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <h2 className="text-lg font-semibold">{t("categoryBreakdown")}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("emptyDescription")}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li className="flex items-center justify-between gap-4" key={item.category_id ?? "uncategorized"}>
              <span className="text-sm">{item.category_name || t("uncategorized")}</span>
              <span className="text-sm font-semibold">{toDisplayAmount(item.total_minor, locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
