"use client";

import { useTranslations } from "next-intl";

import { AiSettingsCard } from "@/components/settings/AiSettingsCard";
import { AutoDeleteToggle } from "@/components/settings/AutoDeleteToggle";
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";
import { WorkspaceCurrencySelector } from "@/components/settings/WorkspaceCurrencySelector";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { InfoCard, PageHeading } from "@/components/ui";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const nav = useTranslations("nav");
  const {
    autoDeleteAfterExtraction,
    currency,
    currencyLocked,
    memberCount,
    role,
    workspaceId,
    workspaceName,
    workspaceType,
  } = useWorkspaceContext();

  return (
    <div className="space-y-6">
      <PageHeading title={t("title")} />
      <InfoCard title={t("workspaceInfo")}>
        <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
          {workspaceType === "personal" ? nav("workspaceTypePersonal") : nav("workspaceTypeTeam")}
        </p>
        <p className="text-sm text-card-foreground">{workspaceName}</p>
        {workspaceType === "team" && (
          <p className="mt-2 text-sm text-muted-foreground">
            {memberCount <= 1 ? nav("noTeamMembersYet") : nav("memberCount", { count: memberCount })}
          </p>
        )}
      </InfoCard>
      <InfoCard title={t("language")}>
        <p className="mt-2 text-sm text-muted-foreground">{t("languageDescription")}</p>
        <LanguageSwitcher />
      </InfoCard>
      <InstallPrompt placement="settings" />
      <AutoDeleteToggle
        autoDeleteAfterExtraction={autoDeleteAfterExtraction}
        role={role}
        workspaceId={workspaceId}
      />
      <WorkspaceCurrencySelector
        currency={currency}
        currencyLocked={currencyLocked}
        role={role}
        workspaceId={workspaceId}
      />
      <AiSettingsCard role={role} workspaceId={workspaceId} />
    </div>
  );
}
