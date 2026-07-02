"use client";

import { Bot } from "lucide-react";
import { useTranslations } from "next-intl";

import type { RecentRecord } from "@/lib/api/dashboard";
import { toDisplayAmount } from "@/lib/money";

export function RecentActivity({
  records,
  pendingAiCount,
  locale,
}: {
  records: RecentRecord[];
  pendingAiCount: number;
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
      {/* No workspace can have AI configured before Phase 7 (BYOK settings) exists, so
          `pendingAiCount === 0` is currently always true and always means "not configured."
          Once Phase 8 makes a nonzero-but-caught-up count possible, this must switch to a
          real "is AI configured" flag instead of inferring it from the count. */}
      {pendingAiCount === 0 && <p className="mt-2 text-xs text-muted-foreground">{t("aiUnavailable")}</p>}
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
              <p className="text-sm font-semibold">{toDisplayAmount(record.amount_minor, locale)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
