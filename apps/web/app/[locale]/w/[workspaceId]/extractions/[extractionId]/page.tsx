"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { EmptyState, ErrorState } from "@/components/dashboard/DataState";
import { DiscardExtractionDialog } from "@/components/extraction/DiscardExtractionDialog";
import { ExtractionReviewForm } from "@/components/extraction/ExtractionReviewForm";
import { getExtraction } from "@/lib/api/extractions";
import { getFileDownloadUrl } from "@/lib/api/files";
import { useWorkspaceContext } from "@/lib/workspace-context";

export default function ExtractionReviewPage() {
  const params = useParams<{ extractionId: string }>();
  const t = useTranslations("extraction");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const { workspaceId, autoDeleteAfterExtraction, currency } = useWorkspaceContext();
  const extraction = useQuery({
    queryKey: ["extractions", workspaceId, params.extractionId],
    queryFn: () => getExtraction(workspaceId, params.extractionId),
    enabled: Boolean(workspaceId && params.extractionId),
  });
  const filePreview = useQuery({
    queryKey: ["files", workspaceId, extraction.data?.file_id, "preview"],
    queryFn: () => getFileDownloadUrl(workspaceId, extraction.data!.file_id),
    enabled: Boolean(workspaceId && extraction.data?.file_id),
  });

  if (extraction.isLoading) {
    return <p className="text-sm text-muted-foreground">{common("loading")}</p>;
  }

  if (extraction.isError || !extraction.data) {
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
      <div className="space-y-4">
        <ExtractionReviewForm
          autoDeleteAfterExtraction={autoDeleteAfterExtraction}
          currency={currency}
          extraction={extraction.data}
          workspaceId={workspaceId}
          onConfirmed={() => void extraction.refetch()}
        />
        <DiscardExtractionDialog
          extraction={extraction.data}
          workspaceId={workspaceId}
          onDiscarded={() => void extraction.refetch()}
        />
      </div>
    </div>
  );
}
