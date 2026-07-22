"use client";

import { CheckCircle2, CircleOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { DateDisplay, Ltr } from "@/components/ui";
import type { AiSettingsStatus } from "@/lib/api/ai-settings";

type AiKeyStatusProps = {
  status: AiSettingsStatus;
};

function safeMaskedHint(value: string) {
  const suffix = value.replace(/[^A-Za-z0-9]/g, "").slice(-4);
  return suffix ? `****${suffix}` : "****";
}

export function AiKeyStatus({ status }: AiKeyStatusProps) {
  const t = useTranslations("aiSettings");
  const providerLabel = status.provider ? t(`providers.${status.provider}`) : null;
  const updatedAt = status.updated_at ?? null;

  if (!status.configured) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-dashed p-4">
        <CircleOff className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">{t("status.notConfigured")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("status.noKeyHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t("status.configured")}
        </span>
        {providerLabel ? (
          <span className="text-sm font-medium">
            <Ltr>{providerLabel}</Ltr>
          </span>
        ) : null}
        {status.masked_hint ? (
          <code className="rounded bg-muted px-2 py-1 text-xs">
            <Ltr>{safeMaskedHint(status.masked_hint)}</Ltr>
          </code>
        ) : null}
      </div>
      {updatedAt ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("status.updatedPrefix")} <DateDisplay date={updatedAt} /> {t("status.updatedBy", { user: status.updated_by_name ?? t("status.unknownUser") })}
        </p>
      ) : null}
    </div>
  );
}
