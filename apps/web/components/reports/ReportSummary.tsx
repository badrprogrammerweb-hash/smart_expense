"use client";

import { useTranslations } from "next-intl";

import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";
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
import { formatDisplayDate } from "@/lib/format/date";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { EmptyState as PrimitiveEmptyState, ErrorState as PrimitiveErrorState, PageHeading, Skeleton } from "@/components/ui";

type ReportSummaryProps = {
  workspaceId: string;
  locale: string;
};

export function ReportSummary({ workspaceId, locale }: ReportSummaryProps) {
  const t = useTranslations("reports");
  const dashboardT = useTranslations("dashboard");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const reports = useReports(workspaceId);
  const { role } = useWorkspaceContext();

  if (reports.isLoading) {
    return <Skeleton className="h-64 w-full" label={common("loading")} />;
  }

  if (reports.isError || !reports.data) {
    return (
      <PrimitiveErrorState
        title={errors("loadFailedTitle")}
        description={errors("requestFailed")}
        retry={() => void reports.refetch()}
        retryLabel={common("retry")}
      />
    );
  }

  const data = reports.data;
  // "Current period" was printed for every range, including the previous month
  // and custom ranges the user had just chosen (BUG-21). The API echoes the
  // preset back, so the heading and the KPI card name the real range.
  const periodKey =
    data.period.preset === "previous_month"
      ? "PreviousMonth"
      : data.period.preset === "custom"
        ? "Custom"
        : "CurrentMonth";
  const periodDates = {
    start: formatDisplayDate(data.period.start),
    end: formatDisplayDate(data.period.end),
  };
  const isEmpty =
    data.category_breakdown.length === 0 &&
    data.summary.total_income_minor === 0 &&
    data.summary.total_expenses_minor === 0;

  return (
    <div className="space-y-6">
      <PageHeading title={t("title")} description={t(`subtitle${periodKey}`, periodDates)} />
      <PeriodSelector onChange={reports.setPeriod} value={reports.period} />
      <SummaryCards locale={locale} period={data.period} summary={data.summary} periodLabel={t(`period${periodKey}`)} />
      <PlainLanguageSummary locale={locale} summary={data.spending_summary} workspaceId={workspaceId} />
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
      {isEmpty && <PrimitiveEmptyState title={dashboardT("emptyPeriod")} description={dashboardT("emptyPeriodHint", periodDates)} />}
      <div className="grid gap-6 xl:grid-cols-2">
        <CategoryBreakdown
          locale={locale}
          items={data.category_breakdown}
          workspaceId={workspaceId}
          period={reports.period}
          emptyDescription={dashboardT("noExpenseCategories")}
        />
        <SpendingTrendChart locale={locale} points={data.spending_trend} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <CategoryBreakdown
          locale={locale}
          items={data.income_category_breakdown}
          workspaceId={workspaceId}
          categoryType="income"
          period={reports.period}
          title={dashboardT("incomeCategoryBreakdown")}
          emptyDescription={dashboardT("noIncomeCategories")}
        />
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
