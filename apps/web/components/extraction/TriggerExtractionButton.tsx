"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ApiError } from "@/lib/api/client";
import { triggerExtraction, type ExtractionRecord } from "@/lib/api/extractions";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { canTriggerExtraction } from "@/lib/permissions";

type TriggerExtractionButtonProps = {
  fileId: string;
  role: WorkspaceRole;
  workspaceId: string;
};

function triggerErrorMessage(error: unknown, t: ReturnType<typeof useTranslations<"extraction">>) {
  if (error instanceof ApiError) {
    if (error.code === "ai_not_configured") {
      return t("errors.aiNotConfigured");
    }
    if (error.code === "extraction_in_progress") {
      return t("errors.extractionInProgress");
    }
    if (error.code === "forbidden") {
      return t("errors.forbidden");
    }
  }
  return t("errors.triggerFailed");
}

export function TriggerExtractionButton({ fileId, role, workspaceId }: TriggerExtractionButtonProps) {
  const t = useTranslations("extraction");
  const queryClient = useQueryClient();
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionRecord | null>(null);

  if (!canTriggerExtraction(role)) {
    return null;
  }

  async function onTrigger() {
    if (isTriggering) {
      return;
    }

    setIsTriggering(true);
    setError(null);
    setResult(null);
    try {
      const extraction = await triggerExtraction(workspaceId, fileId);
      setResult(extraction);
      await queryClient.invalidateQueries({ queryKey: ["extractions", workspaceId] });
    } catch (triggerError) {
      setError(triggerErrorMessage(triggerError, t));
    } finally {
      setIsTriggering(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isTriggering}
        type="button"
        onClick={() => void onTrigger()}
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {isTriggering ? t("status.processing") : t("actions.trigger")}
      </button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && !error && (
        <p className="text-sm text-muted-foreground">
          {result.status === "failed" && result.failure_reason
            ? t(`failureReasons.${result.failure_reason}`)
            : t(`status.${result.status}`)}
        </p>
      )}
    </div>
  );
}
