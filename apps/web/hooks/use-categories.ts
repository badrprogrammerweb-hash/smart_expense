"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCategory,
  deleteCategory,
  getCategories,
  reorderCategories,
  updateCategory,
  type CategoryInput,
  type CategoryType,
  type CreateCategoryInput,
  type ReorderCategoriesInput,
} from "@/lib/api/categories";

export function useCategories(
  workspaceId: string,
  options: { categoryType?: CategoryType; includeArchived?: boolean } = {},
) {
  const categoryType = options.categoryType ?? "expense";
  const includeArchived = options.includeArchived ?? true;

  return useQuery({
    queryKey: ["categories", workspaceId, { categoryType, includeArchived }],
    queryFn: () => getCategories(workspaceId, categoryType, { includeArchived }),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateCategory(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) => createCategory(workspaceId, input),
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

export function useReorderCategories(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReorderCategoriesInput) => reorderCategories(workspaceId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories", workspaceId] });
    },
  });
}

export function useDeleteCategory(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string) => deleteCategory(workspaceId, categoryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories", workspaceId] });
    },
  });
}
