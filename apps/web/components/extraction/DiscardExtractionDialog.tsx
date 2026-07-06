"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ApiError } from "@/lib/api/client";
import { discardExtraction, type ExtractionRecord } from "@/lib/api/extractions";

type DiscardExtractionDialogProps = {
  workspaceId: string;
  extraction: ExtractionRecord;
  onDiscarded?: (extraction: ExtractionRecord) => void;
};

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function DiscardExtractionDialog({
  workspaceId,
  extraction,
  onDiscarded,
}: DiscardExtractionDialogProps) {
  const t = useTranslations("extraction");
  const common = useTranslations("common");
  const queryClient = useQueryClient();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!extraction.can_discard) {
    return null;
  }

  async function onConfirmDiscard() {
    if (isDiscarding) {
      return;
    }

    setIsDiscarding(true);
    setError(null);
    try {
      const discarded = await discardExtraction(workspaceId, extraction.id);
      onDiscarded?.(discarded);
      await queryClient.invalidateQueries({ queryKey: ["extractions", workspaceId] });
      setIsConfirming(false);
    } catch (requestError) {
      setError(errorMessage(requestError, t("errors.discardFailed")));
    } finally {
      setIsDiscarding(false);
    }
  }

  if (!isConfirming) {
    return (
      <button
        className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm text-destructive hover:bg-destructive/10"
        type="button"
        onClick={() => setIsConfirming(true)}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {t("actions.discard")}
      </button>
    );
  }

  return (
    <div className="min-w-64 rounded-md border bg-background p-3 shadow-sm" role="dialog">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">{t("actions.confirmDiscard")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("discard.description")}</p>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="inline-flex h-8 items-center gap-2 rounded-md bg-destructive px-3 text-xs font-medium text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isDiscarding}
          type="button"
          onClick={() => void onConfirmDiscard()}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {common("confirm")}
        </button>
        <button
          className="h-8 rounded-md border px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isDiscarding}
          type="button"
          onClick={() => setIsConfirming(false)}
        >
          {common("cancel")}
        </button>
      </div>
    </div>
  );
}
