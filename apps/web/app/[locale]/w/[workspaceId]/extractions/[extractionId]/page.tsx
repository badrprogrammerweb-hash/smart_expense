"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { EmptyState, ErrorState } from "@/components/dashboard/DataState";
import { ExtractionReviewForm } from "@/components/extraction/ExtractionReviewForm";
import { getCategories } from "@/lib/api/categories";
import { getExtraction } from "@/lib/api/extractions";
import { getFileDownloadUrl } from "@/lib/api/files";
import { useWorkspaceContext } from "@/lib/workspace-context";

export default function ExtractionReviewPage() {
  const params = useParams<{ extractionId: string }>();
  const t = useTranslations("extraction");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const { workspaceId } = useWorkspaceContext();
  const extraction = useQuery({
    queryKey: ["extractions", workspaceId, params.extractionId],
    queryFn: () => getExtraction(workspaceId, params.extractionId),
    enabled: Boolean(workspaceId && params.extractionId),
  });
  const categories = useQuery({
    queryKey: ["categories", workspaceId, { includeArchived: false }],
    queryFn: () => getCategories(workspaceId, { includeArchived: false }),
    enabled: Boolean(workspaceId),
  });
  const filePreview = useQuery({
    queryKey: ["files", workspaceId, extraction.data?.file_id, "preview"],
    queryFn: () => getFileDownloadUrl(workspaceId, extraction.data!.file_id),
    enabled: Boolean(workspaceId && extraction.data?.file_id),
  });

  if (extraction.isLoading || categories.isLoading) {
    return <p className="text-sm text-muted-foreground">{common("loading")}</p>;
  }

  if (extraction.isError || categories.isError || !extraction.data) {
    return <ErrorState title={errors("requestFailed")} />;
  }

  const previewUrl = filePreview.data?.url;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]">
      <section className="min-h-[480px] rounded-lg border bg-card p-4 shadow-sm">
        <h1 className="mb-4 text-lg font-semibold">{t("review.previewTitle")}</h1>
        {previewUrl ? (
          <iframe
            className="h-[560px] w-full rounded-md border bg-background"
            src={previewUrl}
            title={t("review.previewTitle")}
          />
        ) : (
          <EmptyState title={t("review.previewUnavailable")} />
        )}
      </section>
      <ExtractionReviewForm
        categories={categories.data?.categories ?? []}
        extraction={extraction.data}
        workspaceId={workspaceId}
        onConfirmed={() => void extraction.refetch()}
      />
    </div>
  );
}
