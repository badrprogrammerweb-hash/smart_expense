import type { useTranslations } from "next-intl";

import type { WorkspaceRole } from "@/lib/api/workspaces";

type NavTranslator = ReturnType<typeof useTranslations>;

/**
 * The stored role is an API enum (`owner`, `admin`, …) and stays that way
 * everywhere it is compared or sent. It was also rendered straight into the
 * header, so English showed the uncapitalised token "owner role" and Arabic
 * showed "دورك: owner" — an Arabic sentence ending in an English word
 * (BUG-14). This resolves the enum to display copy at the point of render.
 */
const roleKeyByRole: Record<WorkspaceRole, string> = {
  owner: "roleOwner",
  admin: "roleAdmin",
  member: "roleMember",
  viewer: "roleViewer",
};

export function getRoleLabel(t: NavTranslator, role: WorkspaceRole): string {
  return t(roleKeyByRole[role]);
}

/**
 * The literal name the database seeds for every auto-created personal
 * workspace (`ensure_personal_workspace`). It is stored in English, so an
 * Arabic user saw "Personal Workspace" as the largest text on the screen
 * (BUG-15).
 */
const SEEDED_PERSONAL_WORKSPACE_NAME = "Personal Workspace";

/**
 * Resolves a workspace's display name.
 *
 * Only the untouched system-generated default is localized: a name is
 * translated exclusively when the workspace is `personal` *and* still carries
 * the exact seeded literal. Anything the user typed — including a renamed
 * personal workspace — renders verbatim, which is why this is a display-layer
 * rule rather than a migration that would rewrite user-owned rows.
 *
 * A user who renames their personal workspace to exactly "Personal Workspace"
 * is indistinguishable from the default and will see the localized text. That
 * is accepted: the two are the same name, and the alternative is rewriting
 * stored data.
 */
export function getWorkspaceDisplayName(
  t: NavTranslator,
  workspace: { name: string; type: string },
): string {
  if (workspace.type === "personal" && workspace.name === SEEDED_PERSONAL_WORKSPACE_NAME) {
    return t("defaultPersonalWorkspace");
  }

  return workspace.name;
}
