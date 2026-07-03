"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { EmptyState, ErrorState } from "@/components/dashboard/DataState";
import { FileRow } from "@/components/files/FileRow";
import { getFileDownloadUrl, listFiles, type FileMetadata } from "@/lib/api/files";

type FileListProps = {
  workspaceId: string;
};

export function FileList({ workspaceId }: FileListProps) {
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
    return <p className="text-sm text-muted-foreground">{common("loading")}</p>;
  }

  if (files.isError) {
    return (
      <ErrorState
        title={errors("requestFailed")}
        action={
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            type="button"
            onClick={() => void files.refetch()}
          >
            {common("retry")}
          </button>
        }
      />
    );
  }

  const records = files.data?.files ?? [];
  if (records.length === 0) {
    return <EmptyState title={t("emptyState")} />;
  }

  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="border-b p-5">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        {downloadError && <p className="mt-2 text-sm text-destructive">{downloadError}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] table-fixed text-left rtl:text-right">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-60 px-4 py-3 font-medium">{t("list.name")}</th>
              <th className="w-36 px-4 py-3 font-medium">{t("list.type")}</th>
              <th className="w-28 px-4 py-3 font-medium">{t("list.size")}</th>
              <th className="w-44 px-4 py-3 font-medium">{t("list.uploadedAt")}</th>
              <th className="w-44 px-4 py-3 font-medium">{t("list.uploadedBy")}</th>
              <th className="w-40 px-4 py-3 font-medium">{t("list.linkedExpense")}</th>
              <th className="w-28 px-4 py-3 font-medium">{t("list.status")}</th>
              <th className="w-48 px-4 py-3 font-medium">
                <span className="sr-only">{t("actions.download")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((file) => (
              <FileRow
                file={file}
                isOpening={openingFileId === file.id}
                key={file.id}
                onDownload={(selectedFile) => void openSignedUrl(selectedFile)}
                onPreview={(selectedFile) => void openSignedUrl(selectedFile)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
