"use client";

import { useQuery } from "@tanstack/react-query";

import { getDashboard } from "@/lib/api/dashboard";

export function useDashboard(workspaceId: string) {
  return useQuery({
    queryKey: ["dashboard", workspaceId],
    queryFn: () => getDashboard(workspaceId),
    enabled: Boolean(workspaceId),
  });
}
