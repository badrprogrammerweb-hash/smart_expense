import { apiFetch } from "./client";
import type { WorkspaceRole } from "./workspaces";

export type WorkspaceMember = {
  user_id: string;
  email: string;
  role: WorkspaceRole;
};

/**
 * The workspace's members. Files record only the uploader's user id, so this is
 * how a raw UUID is turned into the person it belongs to (BUG-20). The endpoint
 * is already authorised per workspace and returns nothing beyond what the
 * member list elsewhere in the product shows.
 */
export async function getWorkspaceMembers(workspaceId: string) {
  return apiFetch<{ members: WorkspaceMember[] }>(`/workspaces/${workspaceId}/members`);
}
