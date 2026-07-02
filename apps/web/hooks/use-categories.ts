"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createCategory, getCategories, updateCategory, type CategoryInput } from "@/lib/api/categories";

export function useCategories(workspaceId: string, options: { includeArchived?: boolean } = {}) {
  const includeArchived = options.includeArchived ?? true;

  return useQuery({
    queryKey: ["categories", workspaceId, { includeArchived }],
    queryFn: () => getCategories(workspaceId, { includeArchived }),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateCategory(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => createCategory(workspaceId, name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories", workspaceId] });
    },
  });
}

export function useUpdateCategory(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ categoryId, input }: { categoryId: string; input: CategoryInput }) =>
      updateCategory(workspaceId, categoryId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories", workspaceId] });
    },
  });
}
