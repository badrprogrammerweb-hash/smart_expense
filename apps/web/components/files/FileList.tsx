"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { FileRow, formatFileBytes } from "@/components/files/FileRow";
import { listExtractions, type ExtractionRecord } from "@/lib/api/extractions";
import { getFileDownloadUrl, listFiles, type FileMetadata } from "@/lib/api/files";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { Button, DateDisplay, EmptyState, ErrorState, Ltr, MobileRecordCard, Skeleton } from "@/components/ui";

type FileListProps = {
  role: WorkspaceRole;
  workspaceId: string;
};

function latestExtractionByFileId(extractions: ExtractionRecord[]) {
  const byFileId = new Map<string, ExtractionRecord>();
  for (const extraction of extractions) {
    const current = byFileId.get(extraction.file_id);
    if (!current || extraction.triggered_at > current.triggered_at) {
      byFileId.set(extraction.file_id, extraction);
    }
  }
  return byFileId;
}

export function FileList({ role, workspaceId }: FileListProps) {
  const locale = useLocale();
  const t = useTranslations("files");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const files = useQuery({
    queryKey: ["files", workspaceId],
    queryFn: () => listFiles(workspaceId),
    enabled: Boolean(workspaceId),
  });
  // Non-blocking: a file row simply shows no extraction badge until this
  // resolves, so its own loading/error state never blocks the file list.
  const extractions = useQuery({
    queryKey: ["extractions", workspaceId],
    queryFn: () => listExtractions(workspaceId),
    enabled: Boolean(workspaceId),
  });
  const extractionByFileId = latestExtractionByFileId(extractions.data ?? []);

  async function openSignedUrl(file: FileMetadata) {
    setOpeningFileId(file.id);
    setDownloadError(null);
    try {
      const signedUrl = await getFileDownloadUrl(workspaceId, file.id);
      window.open(signedUrl.url, "_blank", "noopener,noreferrer");
    } catch {
      setDownloadError(t("errors.downloadFailed"));
    } finally {
      setOpeningFileId(null);
    }
  }

  if (files.isLoading) {
    return <Skeleton className="h-48 w-full" label={common("loading")} />;
  }

  if (files.isError) {
    return (
      <ErrorState
        title={errors("requestFailed")}
        description={errors("requestFailed")}
        retry={() => void files.refetch()}
        retryLabel={common("retry")}
      />
    );
  }

  const records = files.data?.files ?? [];
  if (records.length === 0) {
    return <EmptyState title={t("emptyState")} />;
  }

  return (
    <section className="rounded-[var(--radius-card)] border bg-card shadow-[var(--shadow-card)]">
      <div className="border-b p-5">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        {downloadError && <p className="mt-2 text-sm text-destructive">{downloadError}</p>}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table aria-label={t("title")} className="w-full min-w-[1120px] table-fixed text-left rtl:text-right">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-60 px-4 py-3 font-medium">{t("list.name")}</th>
              <th className="w-36 px-4 py-3 font-medium">{t("list.type")}</th>
              <th className="w-28 px-4 py-3 font-medium">{t("list.size")}</th>
              <th className="w-44 px-4 py-3 font-medium">{t("list.uploadedAt")}</th>
              <th className="w-44 px-4 py-3 font-medium">{t("list.uploadedBy")}</th>
              <th className="w-40 px-4 py-3 font-medium">{t("list.linkedExpense")}</th>
              <th className="w-28 px-4 py-3 font-medium">{t("list.status")}</th>
              <th className="w-72 px-4 py-3 font-medium">
                <span className="sr-only">{t("actions.download")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((file) => (
              <FileRow
                extraction={extractionByFileId.get(file.id)}
                file={file}
                isOpening={openingFileId === file.id}
                key={file.id}
                onDownload={(selectedFile) => void openSignedUrl(selectedFile)}
                onPreview={(selectedFile) => void openSignedUrl(selectedFile)}
                role={role}
                workspaceId={workspaceId}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 p-4 md:hidden">
        {records.map((file) => (
          <MobileRecordCard
            key={file.id}
            title={<Ltr className="break-words">{file.original_filename}</Ltr>}
            fields={[
              { label: t("list.type"), value: <Ltr>{file.content_type}</Ltr> },
              { label: t("list.size"), value: <Ltr>{formatFileBytes(file.size_bytes, locale)}</Ltr> },
              { label: t("list.uploadedAt"), value: <DateDisplay date={file.created_at} /> },
              { label: t("list.status"), value: file.status },
            ]}
            actions={<><Button size="compact" variant="secondary" disabled={openingFileId === file.id} onClick={() => void openSignedUrl(file)}>{t("actions.preview")}</Button><Button size="compact" variant="secondary" disabled={openingFileId === file.id} onClick={() => void openSignedUrl(file)}>{t("actions.download")}</Button></>}
          />
        ))}
      </div>
    </section>
  );
}
