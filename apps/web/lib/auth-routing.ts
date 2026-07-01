import type { WorkspaceSummary } from "@/lib/api/workspaces";
import { getWorkspaces } from "@/lib/api/workspaces";
import { readLastWorkspaceId, writeLastWorkspaceId } from "@/lib/workspace-context";

type RouterLike = {
  replace(path: string): void;
};

function pickWorkspace(workspaces: WorkspaceSummary[]) {
  const lastWorkspaceId = readLastWorkspaceId();
  const lastWorkspace = workspaces.find((workspace) => workspace.id === lastWorkspaceId);
  const personalWorkspace = workspaces.find((workspace) => workspace.type === "personal");

  return lastWorkspace ?? personalWorkspace ?? workspaces[0];
}

export async function redirectToPreferredWorkspace(locale: string, router: RouterLike) {
  const { workspaces } = await getWorkspaces();
  const workspace = pickWorkspace(workspaces);

  if (!workspace) {
    router.replace(`/${locale}`);
    return;
  }

  writeLastWorkspaceId(workspace.id);
  router.replace(`/${locale}/w/${workspace.id}/dashboard`);
}
