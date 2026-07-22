"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { useUpdateWorkspaceAutoDelete } from "@/hooks/use-workspaces";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { canEditAutoDelete } from "@/lib/permissions";

type AutoDeleteToggleProps = {
  autoDeleteAfterExtraction: boolean;
  role: WorkspaceRole;
  workspaceId: string;
};

export function AutoDeleteToggle({
  autoDeleteAfterExtraction,
  role,
  workspaceId,
}: AutoDeleteToggleProps) {
  const t = useTranslations("files.autoDelete");
  const errors = useTranslations("errors");
  const inputId = useId();
  const descriptionId = `${inputId}-description`;
  const canEdit = canEditAutoDelete(role);
  const updateSetting = useUpdateWorkspaceAutoDelete(workspaceId);
  const [checked, setChecked] = useState(autoDeleteAfterExtraction);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setChecked(autoDeleteAfterExtraction);
  }, [autoDeleteAfterExtraction]);

  async function handleChange(nextValue: boolean) {
    setChecked(nextValue);
    setError(null);

    try {
      await updateSetting.mutateAsync(nextValue);
    } catch {
      setChecked(autoDeleteAfterExtraction);
      setError(errors("requestFailed"));
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <label className="text-lg font-semibold" htmlFor={inputId}>
            {t("label")}
          </label>
          <p className="mt-2 text-sm text-muted-foreground" id={descriptionId}>
            {t("description")}
          </p>
        </div>
        <input
          aria-describedby={descriptionId}
          aria-busy={updateSetting.isPending}
          checked={checked}
          className="h-5 w-5 shrink-0 rounded border-border accent-primary disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canEdit || updateSetting.isPending}
          id={inputId}
          onChange={(event) => void handleChange(event.currentTarget.checked)}
          type="checkbox"
        />
      </div>
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
