"use client";

import { useTranslations } from "next-intl";

import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";
import { EmptyState, ErrorState } from "@/components/dashboard/DataState";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { AiSpendingSummary } from "@/components/reports/AiSpendingSummary";
import { PeriodSelector } from "@/components/reports/PeriodSelector";
import { PendingReviewSummary } from "@/components/reports/PendingReviewSummary";
import { PlainLanguageSummary } from "@/components/reports/PlainLanguageSummary";
import { SpendingTrendChart } from "@/components/reports/SpendingTrendChart";
import { TeamActivitySummary } from "@/components/reports/TeamActivitySummary";
import { TopMerchants } from "@/components/reports/TopMerchants";
import { useReports } from "@/hooks/use-reports";
import { useWorkspaceContext } from "@/lib/workspace-context";

type ReportSummaryProps = {
  workspaceId: string;
  locale: string;
};

export function ReportSummary({ workspaceId, locale }: ReportSummaryProps) {
  const t = useTranslations("reports");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const reports = useReports(workspaceId);
  const { role } = useWorkspaceContext();

  if (reports.isLoading) {
    return <p className="text-sm text-muted-foreground">{common("loading")}</p>;
  }

  if (reports.isError || !reports.data) {
    return (
      <ErrorState
        title={errors("requestFailed")}
        action={
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => void reports.refetch()}
            type="button"
          >
            {common("retry")}
          </button>
        }
      />
    );
  }

  const data = reports.data;
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
      <PeriodSelector onChange={reports.setPeriod} value={reports.period} />
      <SummaryCards locale={locale} period={data.period} summary={data.summary} />
      <PlainLanguageSummary locale={locale} summary={data.spending_summary} />
      <AiSpendingSummary
        locale={locale}
        period={reports.period}
        role={role}
        workspaceId={workspaceId}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <TeamActivitySummary items={data.team_activity} />
        <PendingReviewSummary count={data.pending_review_count} />
      </div>
      {isEmpty && <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />}
      <div className="grid gap-6 xl:grid-cols-2">
        <CategoryBreakdown locale={locale} items={data.category_breakdown} />
        <SpendingTrendChart locale={locale} points={data.spending_trend} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <TopMerchants locale={locale} merchants={data.top_merchants} />
        <RecentActivity
          aiConfigured={undefined}
          locale={locale}
          pendingAiCount={data.pending_review_count}
          records={data.recent_records}
        />
      </div>
    </div>
  );
}
