"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { useWorkspaces } from "@/hooks/use-workspaces";
import { useWorkspaceContext } from "@/lib/workspace-context";

export function WorkspaceSelector() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("nav");
  const errors = useTranslations("errors");
  const common = useTranslations("common");
  const { workspaceId, workspaceType, workspaceName, memberCount } = useWorkspaceContext();
  const workspaces = useWorkspaces();

  function handleSwitch(nextWorkspaceId: string) {
    if (!nextWorkspaceId || nextWorkspaceId === workspaceId) {
      return;
    }

    router.push(`/${locale}/w/${nextWorkspaceId}/dashboard`);
  }

  // The current workspace is always known (from context) before the full
  // list has loaded, so seed the option list with it — otherwise the
  // controlled <select> briefly has a selected value with no matching
  // <option> while `workspaces` is still fetching.
  const options = workspaces.data?.workspaces ?? [{ id: workspaceId, name: workspaceName, type: workspaceType }];

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {workspaceType === "personal" ? t("workspaceTypePersonal") : t("workspaceTypeTeam")}
      </p>
      <h1 className="text-xl font-semibold text-card-foreground">{workspaceName}</h1>
      <label className="mt-1 block text-xs font-medium text-muted-foreground" htmlFor="workspace-switcher">
        {t("switchWorkspace")}
      </label>
      <select
        className="h-9 max-w-xs rounded-md border bg-background px-2 text-sm"
        disabled={workspaces.isLoading}
        id="workspace-switcher"
        onChange={(event) => handleSwitch(event.target.value)}
        value={workspaceId}
      >
        {options.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name} ({workspace.type === "personal" ? t("workspaceTypePersonal") : t("workspaceTypeTeam")})
          </option>
        ))}
      </select>
      {workspaces.isError && (
        <p className="text-xs text-destructive">
          {errors("requestFailed")}{" "}
          <button className="underline" onClick={() => void workspaces.refetch()} type="button">
            {common("retry")}
          </button>
        </p>
      )}
      {workspaceType === "team" && (
        <p className="text-xs text-muted-foreground">
          {memberCount <= 1 ? t("noTeamMembersYet") : t("memberCount", { count: memberCount })}
        </p>
      )}
      <Link
        className="text-xs font-medium text-primary no-underline hover:underline"
        href={`/${locale}/w/${workspaceId}/new-workspace`}
      >
        {t("newWorkspace")}
      </Link>
    </div>
  );
}
