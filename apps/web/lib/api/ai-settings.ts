import { apiFetch } from "./client";

export type AiProvider = "gemini" | "openai";

export type AiSettingsStatus = {
  configured: boolean;
  provider: AiProvider | null;
  masked_hint: string | null;
  updated_at: string | null;
  updated_by: string | null;
  updated_by_name?: string | null;
};

export type AiSettingsUpdateInput = {
  provider: AiProvider;
  apiKey: string;
};

export async function getAiSettings(workspaceId: string) {
  return apiFetch<AiSettingsStatus>(`/workspaces/${workspaceId}/ai-settings`);
}

export async function putAiSettings(workspaceId: string, input: AiSettingsUpdateInput) {
  return apiFetch<AiSettingsStatus>(`/workspaces/${workspaceId}/ai-settings`, {
    method: "PUT",
    body: JSON.stringify({
      provider: input.provider,
      api_key: input.apiKey,
    }),
  });
}

export async function deleteAiSettings(workspaceId: string) {
  return apiFetch<AiSettingsStatus>(`/workspaces/${workspaceId}/ai-settings`, {
    method: "DELETE",
  });
}
