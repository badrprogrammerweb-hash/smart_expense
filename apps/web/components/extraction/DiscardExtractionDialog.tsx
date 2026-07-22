"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ApiError } from "@/lib/api/client";
import { discardExtraction, type ExtractionRecord } from "@/lib/api/extractions";
import { Alert, Button, ConfirmDialog } from "@/components/ui";

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
      <Button variant="destructive" size="compact" type="button" onClick={() => setIsConfirming(true)}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {t("actions.discard")}
      </Button>
    );
  }

  return (
    <><ConfirmDialog open onOpenChange={setIsConfirming} title={t("actions.confirmDiscard")} consequence={t("discard.description")} confirmLabel={common("confirm")} loading={isDiscarding} onConfirm={() => void onConfirmDiscard()} />{error && <Alert className="mt-2" variant="error" title={error} />}</>
  );
}
