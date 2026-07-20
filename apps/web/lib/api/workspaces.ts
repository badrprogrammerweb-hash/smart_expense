import { apiFetch } from "./client";
import type { SupportedCurrency } from "../currency";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type WorkspaceType = "personal" | "team";

export type WorkspaceSummary = {
  id: string;
  type: WorkspaceType;
  name: string;
  role: WorkspaceRole;
  currency: SupportedCurrency;
  auto_delete_after_extraction: boolean;
  currency_locked: boolean;
};

export type WorkspaceDetail = WorkspaceSummary & {
  member_count: number;
};

export type WorkspaceSettingsResponse = {
  id: string;
  currency: SupportedCurrency;
  auto_delete_after_extraction: boolean;
};

export async function getWorkspaces() {
  return apiFetch<{ workspaces: WorkspaceSummary[] }>("/workspaces");
}

export async function getWorkspace(workspaceId: string) {
  return apiFetch<WorkspaceDetail>(`/workspaces/${workspaceId}`);
}

export async function createWorkspace(name: string) {
  return apiFetch<WorkspaceSummary>("/workspaces", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateWorkspaceAutoDelete(workspaceId: string, autoDeleteAfterExtraction: boolean) {
  return apiFetch<WorkspaceSettingsResponse>(`/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: JSON.stringify({ auto_delete_after_extraction: autoDeleteAfterExtraction }),
  });
}

export async function updateWorkspaceCurrency(workspaceId: string, currency: SupportedCurrency) {
  return apiFetch<WorkspaceSettingsResponse>(`/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: JSON.stringify({ currency }),
  });
}
