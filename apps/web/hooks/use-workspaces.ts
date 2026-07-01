"use client";

import { useQuery } from "@tanstack/react-query";

import { getWorkspace, getWorkspaces } from "@/lib/api/workspaces";

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
