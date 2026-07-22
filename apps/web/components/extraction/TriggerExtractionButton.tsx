"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ApiError } from "@/lib/api/client";
import { triggerExtraction, type ExtractionRecord } from "@/lib/api/extractions";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { canTriggerExtraction } from "@/lib/permissions";
import { Alert, Button, PermissionDeniedState } from "@/components/ui";

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
  const common = useTranslations("common");
  const queryClient = useQueryClient();
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionRecord | null>(null);

  if (!canTriggerExtraction(role)) {
    return <PermissionDeniedState action={t("actions.trigger").toLowerCase()} description={t("errors.forbidden")} role="Viewer" title={common("permissionRequired")} />;
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
      <Button variant="secondary" loading={isTriggering} loadingLabel={t("status.processing")} disabled={isTriggering} type="button" onClick={() => void onTrigger()}>
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {t("actions.trigger")}
      </Button>
      {error && <Alert variant="error" title={error} />}
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
