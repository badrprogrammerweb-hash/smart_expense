import { apiFetch } from "./client";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type WorkspaceType = "personal" | "team";

export type WorkspaceSummary = {
  id: string;
  type: WorkspaceType;
  name: string;
  role: WorkspaceRole;
};

export type WorkspaceDetail = WorkspaceSummary & {
  member_count: number;
};

export async function getWorkspaces() {
  return apiFetch<{ workspaces: WorkspaceSummary[] }>("/workspaces");
}

export async function getWorkspace(workspaceId: string) {
  return apiFetch<WorkspaceDetail>(`/workspaces/${workspaceId}`);
}
