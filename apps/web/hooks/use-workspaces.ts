"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createWorkspace,
  getWorkspace,
  getWorkspaces,
  updateWorkspaceAutoDelete,
  updateWorkspaceCurrency,
  type WorkspaceDetail,
} from "@/lib/api/workspaces";
import type { SupportedCurrency } from "@/lib/currency";

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: getWorkspaces,
  });
}

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => getWorkspace(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => createWorkspace(name),
    onSuccess: () => {
      // Not awaited: the workspace list is only needed the next time the
      // switcher renders, not before the caller's post-create redirect.
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}

export function useUpdateWorkspaceAutoDelete(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (autoDeleteAfterExtraction: boolean) =>
      updateWorkspaceAutoDelete(workspaceId, autoDeleteAfterExtraction),
    onSuccess: (updated) => {
      queryClient.setQueryData<WorkspaceDetail>(["workspace", workspaceId], (current) =>
        current
          ? {
              ...current,
              auto_delete_after_extraction: updated.auto_delete_after_extraction,
            }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}

export function useUpdateWorkspaceCurrency(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (currency: SupportedCurrency) => updateWorkspaceCurrency(workspaceId, currency),
    onSuccess: (updated) => {
      queryClient.setQueryData<WorkspaceDetail>(["workspace", workspaceId], (current) =>
        current
          ? {
              ...current,
              currency: updated.currency,
              auto_delete_after_extraction: updated.auto_delete_after_extraction,
            }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}
