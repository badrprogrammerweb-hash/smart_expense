"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { DiscardExtractionDialog } from "@/components/extraction/DiscardExtractionDialog";
import { ExtractionStatusBadge } from "@/components/extraction/ExtractionStatusBadge";
import { listExtractions } from "@/lib/api/extractions";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { DateDisplay, EmptyState, ErrorState, Ltr, MobileRecordCard, Skeleton, Table } from "@/components/ui";

export default function ExtractionsPage() {
  const locale = useLocale();
  const t = useTranslations("extraction");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const { workspaceId } = useWorkspaceContext();
  const extractions = useQuery({
    queryKey: ["extractions", workspaceId, "reviewable"],
    queryFn: () => listExtractions(workspaceId),
    enabled: Boolean(workspaceId),
  });

  if (extractions.isLoading) {
    return <Skeleton className="h-48 w-full" label={common("loading")} />;
  }

  if (extractions.isError) {
    return (
      <ErrorState
        title={errors("requestFailed")}
        description={errors("requestFailed")}
        retry={() => void extractions.refetch()}
        retryLabel={common("retry")}
      />
    );
  }

  const records = (extractions.data ?? []).filter((extraction) =>
    ["ready_for_review", "failed"].includes(extraction.status),
  );
  if (records.length === 0) {
    return <EmptyState title={t("queue.emptyState")} />;
  }

  return (
    <section className="rounded-[var(--radius-card)] border bg-card shadow-[var(--shadow-card)]">
      <div className="border-b p-5">
        <h1 className="text-lg font-semibold">{t("queue.title")}</h1>
      </div>
      <div className="hidden md:block">
        <Table
          caption={t("queue.title")}
          data={records}
          columns={[
            { key: "file", header: t("queue.file"), cell: (extraction) => <Ltr>{extraction.file_id.slice(0, 8)}</Ltr> },
            { key: "status", header: t("queue.status"), cell: (extraction) => <ExtractionStatusBadge failureReason={extraction.failure_reason} status={extraction.status} /> },
            { key: "triggered", header: t("queue.triggeredAt"), cell: (extraction) => <DateDisplay date={extraction.triggered_at} /> },
            { key: "actions", header: t("queue.actions"), cell: (extraction) => <div className="flex flex-wrap gap-2"><Link className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border px-3 text-sm no-underline hover:bg-muted" href={`/${locale}/w/${workspaceId}/extractions/${extraction.id}`}>{t("actions.review")}</Link><DiscardExtractionDialog extraction={extraction} workspaceId={workspaceId} onDiscarded={() => void extractions.refetch()} /></div> },
          ]}
        />
      </div>
      <div className="grid gap-3 p-4 md:hidden">
        {records.map((extraction) => (
          <MobileRecordCard
            key={extraction.id}
            title={<Ltr>{extraction.file_id.slice(0, 8)}</Ltr>}
            fields={[
              { label: t("queue.status"), value: <ExtractionStatusBadge failureReason={extraction.failure_reason} status={extraction.status} /> },
              { label: t("queue.triggeredAt"), value: <DateDisplay date={extraction.triggered_at} /> },
            ]}
            actions={<><Link className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border px-3 text-sm no-underline hover:bg-muted" href={`/${locale}/w/${workspaceId}/extractions/${extraction.id}`}>{t("actions.review")}</Link><DiscardExtractionDialog extraction={extraction} workspaceId={workspaceId} onDiscarded={() => void extractions.refetch()} /></>}
          />
        ))}
      </div>
    </section>
  );
}
