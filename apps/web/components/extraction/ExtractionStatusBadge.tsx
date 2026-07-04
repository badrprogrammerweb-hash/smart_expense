"use client";

import { useTranslations } from "next-intl";

import type { ExtractionStatus } from "@/lib/api/extractions";
import { cn } from "@/lib/utils";

type ExtractionStatusBadgeProps = {
  status: ExtractionStatus;
};

const styles: Record<ExtractionStatus, string> = {
  processing: "border-blue-200 bg-blue-50 text-blue-800",
  ready_for_review: "border-amber-200 bg-amber-50 text-amber-800",
  failed: "border-red-200 bg-red-50 text-red-800",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  discarded: "border-muted bg-muted text-muted-foreground",
};

export function ExtractionStatusBadge({ status }: ExtractionStatusBadgeProps) {
  const t = useTranslations("extraction");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
        styles[status],
      )}
    >
      {t(`status.${status}`)}
    </span>
  );
}
