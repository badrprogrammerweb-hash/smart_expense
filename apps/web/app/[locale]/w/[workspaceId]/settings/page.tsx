"use client";

import { useTranslations } from "next-intl";

import { AiOptionalNotice } from "@/components/settings/AiOptionalNotice";
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";
import { useWorkspaceContext } from "@/lib/workspace-context";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const nav = useTranslations("nav");
  const { workspaceName, workspaceType, memberCount } = useWorkspaceContext();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="text-lg font-semibold">{t("workspaceInfo")}</h2>
        <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
          {workspaceType === "personal" ? nav("workspaceTypePersonal") : nav("workspaceTypeTeam")}
        </p>
        <p className="text-sm text-card-foreground">{workspaceName}</p>
        {workspaceType === "team" && (
          <p className="mt-2 text-sm text-muted-foreground">
            {memberCount <= 1 ? nav("noTeamMembersYet") : nav("memberCount", { count: memberCount })}
          </p>
        )}
      </section>
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="text-lg font-semibold">{t("language")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("languageDescription")}</p>
        <LanguageSwitcher />
      </section>
      <AiOptionalNotice />
    </div>
  );
}
