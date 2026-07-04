"use client";

import { useTranslations } from "next-intl";

import { AiKeyStatus } from "@/components/settings/AiKeyStatus";
import { AiOptionalNotice } from "@/components/settings/AiOptionalNotice";
import { AiProviderKeyForm } from "@/components/settings/AiProviderKeyForm";
import { RemoveAiKeyDialog } from "@/components/settings/RemoveAiKeyDialog";
import { useAiSettings } from "@/hooks/use-ai-settings";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { canManageAiSettings } from "@/lib/permissions";

type AiSettingsCardProps = {
  role: WorkspaceRole;
  workspaceId: string;
};

export function AiSettingsCard({ role, workspaceId }: AiSettingsCardProps) {
  const t = useTranslations("aiSettings");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const query = useAiSettings(workspaceId);
  const status = query.data ?? null;

  return (
    <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <AiOptionalNotice asSection={false} />
          <p className="mt-1 text-xs text-muted-foreground">{t("manualFirstNote")}</p>
        </div>
        {status ? (
          <RemoveAiKeyDialog configured={status.configured} role={role} workspaceId={workspaceId} />
        ) : null}
      </div>

      <div className="mt-5 space-y-5">
        {query.isLoading ? <p className="text-sm text-muted-foreground">{common("loading")}</p> : null}
        {query.isError ? (
          <div className="rounded-md border border-destructive/40 p-4">
            <p className="text-sm text-destructive">{errors("requestFailed")}</p>
            <button
              className="mt-3 h-9 rounded-md border px-3 text-sm font-medium"
              type="button"
              onClick={() => void query.refetch()}
            >
              {common("retry")}
            </button>
          </div>
        ) : null}
        {status ? <AiKeyStatus status={status} /> : null}
        {canManageAiSettings(role) && status ? (
          <AiProviderKeyForm role={role} status={status} workspaceId={workspaceId} />
        ) : null}
      </div>
    </section>
  );
}
