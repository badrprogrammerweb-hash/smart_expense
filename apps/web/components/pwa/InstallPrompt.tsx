"use client";

import { useTranslations } from "next-intl";

import { useInstallCapability } from "@/lib/pwa/install";
import { Button } from "@/components/ui";

type InstallPromptProps = { placement?: "banner" | "settings" };

export function InstallPrompt({ placement = "banner" }: InstallPromptProps) {
  const t = useTranslations("pwa.install");
  const { capability, dismissedThisSession, dismiss, prompt } = useInstallCapability();

  if (capability === "installed" || capability === "unsupported") return null;
  if (placement === "banner" && dismissedThisSession) return null;

  const isManual = capability === "manual";
  const isSettings = placement === "settings";

  return (
    <section
      aria-label={t("title")}
      className={isSettings ? "rounded-[var(--radius-card)] border bg-card p-4 shadow-[var(--shadow-card)]" : "mb-4 rounded-[var(--radius-card)] border border-primary/30 bg-secondary p-4"}
      data-testid={isSettings ? "settings-install-entry" : "install-prompt"}
    >
      <h2 className="text-sm font-semibold text-card-foreground">{isSettings ? t("settingsEntry") : t("title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{isManual ? t("manualInstructions") : t("description")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!isManual ? <Button onClick={() => void prompt()}>{t("action")}</Button> : null}
        {!isSettings ? <Button variant="ghost" onClick={dismiss}>{t("dismiss")}</Button> : null}
      </div>
    </section>
  );
}
