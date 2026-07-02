"use client";

import { useTranslations } from "next-intl";

import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";
import { EmptyState, ErrorState } from "@/components/dashboard/DataState";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { useDashboard } from "@/hooks/use-dashboard";

type ReportSummaryProps = {
  workspaceId: string;
  locale: string;
};

export function ReportSummary({ workspaceId, locale }: ReportSummaryProps) {
  const t = useTranslations("reports");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const dashboard = useDashboard(workspaceId);

  if (dashboard.isLoading) {
    return <p className="text-sm text-muted-foreground">{common("loading")}</p>;
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <ErrorState
        title={errors("requestFailed")}
        action={
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => void dashboard.refetch()}
            type="button"
          >
            {common("retry")}
          </button>
        }
      />
    );
  }

  const data = dashboard.data;
  const isEmpty =
    data.category_breakdown.length === 0 &&
    data.summary.total_income_minor === 0 &&
    data.summary.total_expenses_minor === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("subtitle", { start: data.period.start, end: data.period.end })}
        </p>
      </div>
      {/* Same components the dashboard renders, fed the same dashboard response
          (no separate report API call) — figures can't drift from the dashboard
          by construction, satisfying FR-028. */}
      <SummaryCards locale={locale} period={data.period} summary={data.summary} />
      {isEmpty && <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />}
      <CategoryBreakdown locale={locale} items={data.category_breakdown} />
    </div>
  );
}
