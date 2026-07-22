"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui";
import { useRemoveAiSettings } from "@/hooks/use-ai-settings";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { canManageAiSettings } from "@/lib/permissions";

type RemoveAiKeyDialogProps = {
  configured: boolean;
  role: WorkspaceRole;
  workspaceId: string;
};

export function RemoveAiKeyDialog({ configured, role, workspaceId }: RemoveAiKeyDialogProps) {
  const t = useTranslations("aiSettings");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const removeKey = useRemoveAiSettings(workspaceId);
  const [isConfirming, setIsConfirming] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  if (!canManageAiSettings(role) || !configured) {
    return null;
  }

  async function onConfirmRemove() {
    setRequestError(null);
    try {
      await removeKey.mutateAsync();
      setIsConfirming(false);
    } catch {
      setRequestError(errors("requestFailed"));
    }
  }

  if (!isConfirming) {
    return (
      <Button
        variant="destructive"
        type="button"
        onClick={() => setIsConfirming(true)}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {t("removeAction")}
      </Button>
    );
  }

  return (
    <div className="rounded-md border bg-background p-4" role="dialog">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">{t("removeTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("removeDescription")}</p>
        </div>
      </div>
      {requestError ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {requestError}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="destructive"
          loading={removeKey.isPending}
          type="button"
          onClick={() => void onConfirmRemove()}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {common("confirm")}
        </Button>
        <Button
          variant="secondary"
          disabled={removeKey.isPending}
          type="button"
          onClick={() => setIsConfirming(false)}
        >
          {common("cancel")}
        </Button>
      </div>
    </div>
  );
}
