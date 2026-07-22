"use client";

import { ClipboardList } from "lucide-react";
import { useTranslations } from "next-intl";

type PendingReviewSummaryProps = {
  count: number;
};

export function PendingReviewSummary({ count }: PendingReviewSummaryProps) {
  const t = useTranslations("reports.pendingReview");

  return (
    <section className="rounded-[var(--radius-card)] border bg-card p-5 text-card-foreground shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-semibold">{t("title")}</h2>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {count > 0 ? t("count", { count }) : t("empty")}
      </p>
    </section>
  );
}
