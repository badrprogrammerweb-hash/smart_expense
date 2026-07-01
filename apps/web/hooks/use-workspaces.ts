"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createWorkspace, getWorkspace, getWorkspaces } from "@/lib/api/workspaces";

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
