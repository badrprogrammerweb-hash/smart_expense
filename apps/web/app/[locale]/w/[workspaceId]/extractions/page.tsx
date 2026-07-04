"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { EmptyState, ErrorState } from "@/components/dashboard/DataState";
import { ExtractionStatusBadge } from "@/components/extraction/ExtractionStatusBadge";
import { listExtractions } from "@/lib/api/extractions";
import { useWorkspaceContext } from "@/lib/workspace-context";

export default function ExtractionsPage() {
  const locale = useLocale();
  const t = useTranslations("extraction");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const { workspaceId } = useWorkspaceContext();
  const extractions = useQuery({
    queryKey: ["extractions", workspaceId, "ready_for_review"],
    queryFn: () => listExtractions(workspaceId, "ready_for_review"),
    enabled: Boolean(workspaceId),
  });

  if (extractions.isLoading) {
    return <p className="text-sm text-muted-foreground">{common("loading")}</p>;
  }

  if (extractions.isError) {
    return (
      <ErrorState
        title={errors("requestFailed")}
        action={
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            type="button"
            onClick={() => void extractions.refetch()}
          >
            {common("retry")}
          </button>
        }
      />
    );
  }

  const records = extractions.data ?? [];
  if (records.length === 0) {
    return <EmptyState title={t("queue.emptyState")} />;
  }

  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="border-b p-5">
        <h1 className="text-lg font-semibold">{t("queue.title")}</h1>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed text-left rtl:text-right">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-64 px-4 py-3 font-medium">{t("queue.file")}</th>
              <th className="w-48 px-4 py-3 font-medium">{t("queue.status")}</th>
              <th className="w-48 px-4 py-3 font-medium">{t("queue.triggeredAt")}</th>
              <th className="w-40 px-4 py-3 font-medium">{t("queue.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {records.map((extraction) => (
              <tr className="border-b last:border-b-0" key={extraction.id}>
                <td className="px-4 py-3 text-sm">{extraction.file_id.slice(0, 8)}</td>
                <td className="px-4 py-3">
                  <ExtractionStatusBadge status={extraction.status} />
                </td>
                <td className="px-4 py-3 text-sm">
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(extraction.triggered_at))}
                </td>
                <td className="px-4 py-3">
                  <Link
                    className="inline-flex h-9 items-center rounded-md border px-3 text-sm no-underline hover:bg-muted"
                    href={`/${locale}/w/${workspaceId}/extractions/${extraction.id}`}
                  >
                    {t("actions.confirm")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
