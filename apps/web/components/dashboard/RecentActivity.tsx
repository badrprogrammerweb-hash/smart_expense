"use client";

import { Bot } from "lucide-react";
import { useTranslations } from "next-intl";

import type { RecentRecord } from "@/lib/api/dashboard";
import { toDisplayAmount } from "@/lib/money";

export function RecentActivity({
  records,
  pendingAiCount,
  aiConfigured,
  locale,
}: {
  records: RecentRecord[];
  pendingAiCount: number;
  aiConfigured: boolean | undefined;
  locale: string;
}) {
  const t = useTranslations("dashboard");

  return (
    <section className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("recentActivity")}</h2>
        <p className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">
          <Bot className="h-3.5 w-3.5" aria-hidden="true" />
          {t("pendingAi", { count: pendingAiCount })}
        </p>
      </div>
      {aiConfigured === false && (
        <p className="mt-2 text-xs text-muted-foreground">{t("aiUnavailable")}</p>
      )}
      {records.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("emptyDescription")}</p>
      ) : (
        <ul className="mt-4 divide-y">
          {records.map((record) => (
            <li className="flex items-center justify-between gap-4 py-3" key={`${record.type}-${record.id}`}>
              <div>
                <p className="text-sm font-medium">{record.description || record.merchant_name || record.type}</p>
                <p className="text-xs text-muted-foreground">{record.occurred_on}</p>
              </div>
              <p className="text-sm font-semibold">
                {toDisplayAmount(record.amount_minor, locale, record.currency)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
