"use client";

import { useLocale, useTranslations } from "next-intl";

import { EmptyState, ErrorState } from "@/components/dashboard/DataState";
import { HistoryEmptyState } from "@/components/history/HistoryEmptyState";
import { HistoryList } from "@/components/history/HistoryList";
import { useHistory } from "@/hooks/use-history";
import { canViewHistory } from "@/lib/permissions";
import { useWorkspaceContext } from "@/lib/workspace-context";

export default function HistoryPage() {
  const locale = useLocale();
  const t = useTranslations("history");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const { workspaceId, role } = useWorkspaceContext();
  const history = useHistory(workspaceId);
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];

  if (!canViewHistory(role)) {
    return <EmptyState title={t("title")} description={t("notAuthorized")} />;
  }

  if (history.isLoading) {
    return <p className="text-sm text-muted-foreground">{common("loading")}</p>;
  }

  if (history.isError) {
    return (
      <ErrorState
        title={errors("requestFailed")}
        action={
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => void history.refetch()}
            type="button"
          >
            {common("retry")}
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
      </div>
      {items.length === 0 ? <HistoryEmptyState /> : <HistoryList items={items} locale={locale} />}
      {history.hasNextPage && (
        <button
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          disabled={history.isFetchingNextPage}
          onClick={() => void history.fetchNextPage()}
          type="button"
        >
          {history.isFetchingNextPage ? common("loading") : t("loadMore")}
        </button>
      )}
    </div>
  );
}
