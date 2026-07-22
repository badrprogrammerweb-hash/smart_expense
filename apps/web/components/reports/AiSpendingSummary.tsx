"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useAiSettings } from "@/hooks/use-ai-settings";
import type { ReportPeriodInput } from "@/lib/api/reports";
import { requestAiSummary, type AiSummaryLocale } from "@/lib/api/reports";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { canRequestAiSummary } from "@/lib/permissions";

type AiSpendingSummaryProps = {
  workspaceId: string;
  role: WorkspaceRole;
  period: ReportPeriodInput;
  locale: string;
};

function summaryLocale(locale: string): AiSummaryLocale {
  return locale === "ar" ? "ar" : "en";
}

export function AiSpendingSummary({
  workspaceId,
  role,
  period,
  locale,
}: AiSpendingSummaryProps) {
  const t = useTranslations("aiSummary");
  const settings = useAiSettings(workspaceId);
  const [text, setText] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (!canRequestAiSummary(role) || settings.isLoading || !settings.data?.configured) {
    return null;
  }

  async function handleRequest() {
    setIsGenerating(true);
    setHasError(false);
    try {
      const response = await requestAiSummary(workspaceId, period, summaryLocale(locale));
      setText(response.text);
    } catch {
      setText(null);
      setHasError(true);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border bg-card p-5 text-card-foreground shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          {hasError && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {t("error")}
            </p>
          )}
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isGenerating}
          onClick={() => void handleRequest()}
          type="button"
        >
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          {isGenerating ? t("loading") : t("request")}
        </button>
      </div>
      {text && (
        <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">{text}</p>
      )}
    </section>
  );
}
