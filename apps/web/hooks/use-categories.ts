"use client";

import { useQuery } from "@tanstack/react-query";

import { getCategories } from "@/lib/api/categories";

export function useCategories(workspaceId: string, options: { includeArchived?: boolean } = {}) {
  const includeArchived = options.includeArchived ?? true;

  return useQuery({
    queryKey: ["categories", workspaceId, { includeArchived }],
    queryFn: () => getCategories(workspaceId, { includeArchived }),
    enabled: Boolean(workspaceId),
  });
}
