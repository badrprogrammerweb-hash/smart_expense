"use client";

import { useTranslations } from "next-intl";

import type { ExtractionStatus, FailureReason } from "@/lib/api/extractions";
import { StatusBadge } from "@/components/ui";

type ExtractionStatusBadgeProps = {
  status: ExtractionStatus;
  failureReason?: FailureReason | null;
};

const statusVariants: Record<ExtractionStatus, "confirmed" | "pending" | "failed" | "neutral"> = {
  processing: "pending",
  ready_for_review: "pending",
  failed: "failed",
  confirmed: "confirmed",
  discarded: "neutral",
};

export function ExtractionStatusBadge({ status, failureReason }: ExtractionStatusBadgeProps) {
  const t = useTranslations("extraction");

  return (
    <div className="flex flex-col items-start gap-1">
      <StatusBadge status={statusVariants[status]} label={t(`status.${status}`)} />
      {/* Always a fixed, translated reason -- never raw provider text
          (research.md Decision 6; FR-019). */}
      {status === "failed" && failureReason && (
        <span className="text-xs text-muted-foreground">{t(`failureReasons.${failureReason}`)}</span>
      )}
    </div>
  );
}
