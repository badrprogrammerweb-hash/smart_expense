"use client";

import { Download, Eye } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { DeleteFileDialog } from "@/components/files/DeleteFileDialog";
import { ExtractionStatusBadge } from "@/components/extraction/ExtractionStatusBadge";
import { TriggerExtractionButton } from "@/components/extraction/TriggerExtractionButton";
import type { ExtractionRecord } from "@/lib/api/extractions";
import type { FileMetadata } from "@/lib/api/files";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { DateDisplay, Ltr } from "@/components/ui";

type FileRowProps = {
  extraction?: ExtractionRecord;
  file: FileMetadata;
  isOpening: boolean;
  onDownload: (file: FileMetadata) => void;
  onPreview: (file: FileMetadata) => void;
  role: WorkspaceRole;
  workspaceId: string;
};

export function formatFileBytes(value: number, locale: string) {
  if (value < 1024) {
    return new Intl.NumberFormat(locale).format(value) + " B";
  }

  const units = ["KB", "MB"];
  let unitIndex = 0;
  let size = value / 1024;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return (
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: size >= 10 ? 0 : 1,
    }).format(size) +
    " " +
    units[unitIndex]
  );
}

export function FileRow({
  extraction,
  file,
  isOpening,
  onDownload,
  onPreview,
  role,
  workspaceId,
}: FileRowProps) {
  const locale = useLocale();
  const t = useTranslations("files");
  const common = useTranslations("common");
  const linkedLabel = file.expense_id ? file.expense_id.slice(0, 8) : common("none");

  return (
    <tr className="border-b last:border-b-0">
      <td className="min-w-56 px-4 py-3 align-top">
        <div>
          <Ltr className="break-words text-sm font-medium">{file.original_filename}</Ltr>
        </div>
      </td>
      <td className="px-4 py-3 align-top text-sm"><Ltr>{file.content_type}</Ltr></td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-sm">
        <Ltr>{formatFileBytes(file.size_bytes, locale)}</Ltr>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-sm">
        <DateDisplay date={file.created_at} />
      </td>
      <td className="max-w-44 break-words px-4 py-3 align-top text-sm"><Ltr>{file.uploaded_by}</Ltr></td>
      <td className="px-4 py-3 align-top text-sm">
        <span
          className="inline-flex max-w-36 items-center rounded-md border px-2 py-1 text-xs"
          title={file.expense_id ?? linkedLabel}
        >
          {/* Only the expense-id slice is a technical value; the "none"
              fallback is translated Arabic/English UI copy and must not be
              forced into an LTR isolation span (FR-006/007). */}
          {file.expense_id ? <Ltr>{linkedLabel}</Ltr> : linkedLabel}
        </span>
      </td>
      <td className="px-4 py-3 align-top text-sm">
        <span className="inline-flex items-center rounded-md border px-2 py-1 text-xs">
          {file.status}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top">
        <div className="flex flex-wrap gap-2">
          <button
            aria-label={`${t("actions.preview")} ${file.original_filename}`}
            className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isOpening}
            title={t("actions.preview")}
            type="button"
            onClick={() => onPreview(file)}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            {t("actions.preview")}
          </button>
          <button
            aria-label={`${t("actions.download")} ${file.original_filename}`}
            className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isOpening}
            title={t("actions.download")}
            type="button"
            onClick={() => onDownload(file)}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {t("actions.download")}
          </button>
          {extraction && (
            <ExtractionStatusBadge
              failureReason={extraction.failure_reason}
              status={extraction.status}
            />
          )}
          {file.status === "active" && !file.expense_id && (
            <TriggerExtractionButton fileId={file.id} role={role} workspaceId={workspaceId} />
          )}
          <DeleteFileDialog file={file} role={role} workspaceId={workspaceId} />
        </div>
      </td>
    </tr>
  );
}
