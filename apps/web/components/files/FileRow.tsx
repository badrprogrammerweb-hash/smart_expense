"use client";

import { Download, Eye } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { FileMetadata } from "@/lib/api/files";

type FileRowProps = {
  file: FileMetadata;
  isOpening: boolean;
  onDownload: (file: FileMetadata) => void;
  onPreview: (file: FileMetadata) => void;
};

function formatBytes(value: number, locale: string) {
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

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function FileRow({ file, isOpening, onDownload, onPreview }: FileRowProps) {
  const locale = useLocale();
  const t = useTranslations("files");
  const common = useTranslations("common");
  const linkedLabel = file.expense_id ? file.expense_id.slice(0, 8) : common("none");

  return (
    <tr className="border-b last:border-b-0">
      <td className="min-w-56 px-4 py-3 align-top">
        <div>
          <p className="break-words text-sm font-medium">{file.original_filename}</p>
        </div>
      </td>
      <td className="px-4 py-3 align-top text-sm">{file.content_type}</td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-sm">
        {formatBytes(file.size_bytes, locale)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-sm">
        {formatDate(file.created_at, locale)}
      </td>
      <td className="max-w-44 break-words px-4 py-3 align-top text-sm">{file.uploaded_by}</td>
      <td className="px-4 py-3 align-top text-sm">
        <span
          className="inline-flex max-w-36 items-center rounded-md border px-2 py-1 text-xs"
          title={file.expense_id ?? linkedLabel}
        >
          {linkedLabel}
        </span>
      </td>
      <td className="px-4 py-3 align-top text-sm">
        <span className="inline-flex items-center rounded-md border px-2 py-1 text-xs">
          {file.status}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top">
        <div className="flex gap-2">
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
        </div>
      </td>
    </tr>
  );
}
