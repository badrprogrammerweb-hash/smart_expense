"use client";

import { Users } from "lucide-react";
import { useTranslations } from "next-intl";

import type { TeamActivityItem } from "@/lib/api/reports";

type TeamActivitySummaryProps = {
  items: TeamActivityItem[];
};

export function TeamActivitySummary({ items }: TeamActivitySummaryProps) {
  const t = useTranslations("reports.teamActivity");

  return (
    <section className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-semibold">{t("title")}</h2>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="mt-4 divide-y">
          {items.map((item) => (
            <li className="flex items-center justify-between gap-4 py-3" key={item.user_id}>
              <p className="min-w-0 truncate text-sm font-medium">{item.display_name}</p>
              <p className="shrink-0 text-sm text-muted-foreground">
                {t("recordCount", { count: item.records_created })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
