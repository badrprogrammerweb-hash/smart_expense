"use client";

import { useTranslations } from "next-intl";

import type { ExtractionStatus, FailureReason } from "@/lib/api/extractions";
import { cn } from "@/lib/utils";

type ExtractionStatusBadgeProps = {
  status: ExtractionStatus;
  failureReason?: FailureReason | null;
};

const styles: Record<ExtractionStatus, string> = {
  processing: "border-blue-200 bg-blue-50 text-blue-800",
  ready_for_review: "border-amber-200 bg-amber-50 text-amber-800",
  failed: "border-red-200 bg-red-50 text-red-800",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  discarded: "border-muted bg-muted text-muted-foreground",
};

export function ExtractionStatusBadge({ status, failureReason }: ExtractionStatusBadgeProps) {
  const t = useTranslations("extraction");

  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={cn(
          "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
          styles[status],
        )}
      >
        {t(`status.${status}`)}
      </span>
      {/* Always a fixed, translated reason -- never raw provider text
          (research.md Decision 6; FR-019). */}
      {status === "failed" && failureReason && (
        <span className="text-xs text-muted-foreground">{t(`failureReasons.${failureReason}`)}</span>
      )}
    </div>
  );
}
