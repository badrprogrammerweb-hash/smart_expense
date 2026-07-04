"use client";

import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { useConfigureAiSettings } from "@/hooks/use-ai-settings";
import type { AiProvider, AiSettingsStatus } from "@/lib/api/ai-settings";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { canManageAiSettings } from "@/lib/permissions";

type AiProviderKeyFormProps = {
  role: WorkspaceRole;
  status: AiSettingsStatus | null;
  workspaceId: string;
};

const PROVIDERS: AiProvider[] = ["openai", "gemini"];
const keyShape = /^[A-Za-z0-9_-]+$/;

function isValidKey(provider: AiProvider, value: string) {
  if (value !== value.trim() || value.length === 0 || value.length > 400 || !keyShape.test(value)) {
    return false;
  }
  if (provider === "openai") {
    return value.startsWith("sk-") && value.length >= 20;
  }
  return value.startsWith("AIza") && value.length >= 35 && value.length <= 45;
}

export function AiProviderKeyForm({ role, status, workspaceId }: AiProviderKeyFormProps) {
  const t = useTranslations("aiSettings");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const keyInputId = useId();
  const providerId = useId();
  const configure = useConfigureAiSettings(workspaceId);
  const [provider, setProvider] = useState<AiProvider>(status?.provider ?? "openai");
  const [apiKey, setApiKey] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    if (status?.provider) {
      setProvider(status.provider);
    }
  }, [status?.provider]);

  if (!canManageAiSettings(role)) {
    return null;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);
    setRequestError(null);

    if (!apiKey) {
      setValidationError(t("errors.requiredKey"));
      return;
    }
    if (!isValidKey(provider, apiKey)) {
      setValidationError(t("errors.invalidKeyFormat"));
      return;
    }

    try {
      await configure.mutateAsync({ provider, apiKey });
      setApiKey("");
    } catch {
      setRequestError(errors("requestFailed"));
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <div>
          <label className="text-sm font-medium" htmlFor={providerId}>
            {t("providerLabel")}
          </label>
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            id={providerId}
            value={provider}
            onChange={(event) => setProvider(event.currentTarget.value as AiProvider)}
          >
            {PROVIDERS.map((value) => (
              <option key={value} value={value}>
                {t(`providers.${value}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor={keyInputId}>
            {status?.configured ? t("replaceKeyLabel") : t("keyLabel")}
          </label>
          <input
            autoComplete="off"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            id={keyInputId}
            type="password"
            value={apiKey}
            onChange={(event) => {
              setApiKey(event.currentTarget.value);
              setValidationError(null);
            }}
          />
          <p className="mt-1 text-xs text-muted-foreground">{t(`formatHints.${provider}`)}</p>
        </div>
      </div>
      {validationError ? (
        <p className="text-sm text-destructive" role="alert">
          {validationError}
        </p>
      ) : null}
      {requestError ? (
        <p className="text-sm text-destructive" role="alert">
          {requestError}
        </p>
      ) : null}
      <button
        className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        disabled={configure.isPending}
        type="submit"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        {status?.configured ? t("replaceAction") : common("save")}
      </button>
    </form>
  );
}
