"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteAiSettings,
  getAiSettings,
  putAiSettings,
  type AiSettingsStatus,
  type AiSettingsUpdateInput,
} from "@/lib/api/ai-settings";

export function useAiSettings(workspaceId: string) {
  return useQuery({
    queryKey: ["ai-settings", workspaceId],
    queryFn: () => getAiSettings(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useConfigureAiSettings(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AiSettingsUpdateInput) => putAiSettings(workspaceId, input),
    onSuccess: (status) => {
      queryClient.setQueryData<AiSettingsStatus>(["ai-settings", workspaceId], status);
      void queryClient.invalidateQueries({ queryKey: ["ai-settings", workspaceId] });
    },
  });
}

export function useRemoveAiSettings(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteAiSettings(workspaceId),
    onSuccess: (status) => {
      queryClient.setQueryData<AiSettingsStatus>(["ai-settings", workspaceId], status);
      void queryClient.invalidateQueries({ queryKey: ["ai-settings", workspaceId] });
    },
  });
}
