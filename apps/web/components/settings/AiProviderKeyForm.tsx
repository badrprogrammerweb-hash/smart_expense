"use client";

import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { useConfigureAiSettings } from "@/hooks/use-ai-settings";
import { MutationDisabledNotice, useConnectivity } from "@/components/connectivity";
import type { AiProvider, AiSettingsStatus } from "@/lib/api/ai-settings";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { canManageAiSettings } from "@/lib/permissions";
import { Alert, Button, Input, PermissionDeniedState, Select } from "@/components/ui";

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
  const { canMutate } = useConnectivity();

  useEffect(() => {
    if (status?.provider) {
      setProvider(status.provider);
    }
  }, [status?.provider]);

  if (!canManageAiSettings(role)) {
    return <PermissionDeniedState action={t("title").toLowerCase()} description={t("viewerBlocked")} role={role === "viewer" ? "Viewer" : "Member"} title={common("permissionRequired")} />;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canMutate) return;
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
          <Select
            className="mt-1"
            id={providerId}
            value={provider}
            onChange={(event) => setProvider(event.currentTarget.value as AiProvider)}
            disabled={!canMutate || configure.isPending}
          >
            {PROVIDERS.map((value) => (
              <option key={value} value={value}>
                {t(`providers.${value}`)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor={keyInputId}>
            {status?.configured ? t("replaceKeyLabel") : t("keyLabel")}
          </label>
          <Input
            autoComplete="off"
            className="mt-1"
            id={keyInputId}
            type="password"
            value={apiKey}
            onChange={(event) => {
              setApiKey(event.currentTarget.value);
              setValidationError(null);
            }}
            disabled={!canMutate || configure.isPending}
          />
          <p className="mt-1 text-xs text-muted-foreground">{t(`formatHints.${provider}`)}</p>
        </div>
      </div>
      {validationError ? <Alert variant="error" title={validationError} /> : null}
      {requestError ? <Alert variant="error" title={requestError} /> : null}
      <Button loading={configure.isPending} disabled={!canMutate} type="submit">
        <Save className="h-4 w-4" aria-hidden="true" />
        {status?.configured ? t("replaceAction") : common("save")}
      </Button>
      <MutationDisabledNotice />
    </form>
  );
}
