"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { useDashboard } from "@/hooks/use-dashboard";
import { getAiSettings } from "@/lib/api/ai-settings";
import { canCreateExpense, canManageIncome } from "@/lib/permissions";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { EmptyState as PrimitiveEmptyState, ErrorState as PrimitiveErrorState, PageHeading, Skeleton } from "@/components/ui";

export default function DashboardPage() {
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const { workspaceId, role } = useWorkspaceContext();
  const dashboard = useDashboard(workspaceId);
  const aiSettings = useQuery({
    queryKey: ["ai-settings", workspaceId],
    queryFn: () => getAiSettings(workspaceId),
    enabled: Boolean(workspaceId),
  });
  const canAddIncome = canManageIncome(role);
  const canAddExpense = canCreateExpense(role);

  if (dashboard.isLoading) {
    return <Skeleton className="h-48 w-full" label={common("loading")} />;
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <PrimitiveErrorState
        title={errors("requestFailed")}
        description={errors("requestFailed")}
        retry={() => void dashboard.refetch()}
        retryLabel={common("retry")}
      />
    );
  }

  const data = dashboard.data;
  const isEmpty = data.recent_records.length === 0 && data.category_breakdown.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading title={t("title")} description={t("subtitle", { start: data.period.start, end: data.period.end })} />
        <div className="flex gap-2">
          {canAddIncome && (
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground no-underline"
              href={`/${locale}/w/${workspaceId}/incomes`}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("addIncome")}
            </Link>
          )}
          {canAddExpense && (
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium no-underline hover:bg-muted"
              href={`/${locale}/w/${workspaceId}/expenses`}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("addExpense")}
            </Link>
          )}
        </div>
      </div>
      <SummaryCards locale={locale} period={data.period} summary={data.summary} />
      {isEmpty && <PrimitiveEmptyState title={t("emptyTitle")} description={t("emptyDescription")} />}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <RecentActivity
          aiConfigured={aiSettings.data?.configured}
          locale={locale}
          pendingAiCount={data.pending_ai_count}
          records={data.recent_records}
        />
        <CategoryBreakdown
          locale={locale}
          items={data.category_breakdown}
          workspaceId={workspaceId}
          period={{ period: "custom", start: data.period.start, end: data.period.end }}
        />
      </div>
    </div>
  );
}
