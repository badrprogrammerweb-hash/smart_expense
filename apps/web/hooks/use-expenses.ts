"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createExpense, deleteExpense, listExpenses, updateExpense, type ExpenseInput } from "@/lib/api/expenses";

export function useExpenses(workspaceId: string) {
  return useQuery({
    queryKey: ["expenses", workspaceId],
    queryFn: () => listExpenses(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateExpense(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ExpenseInput) => createExpense(workspaceId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] }),
      ]);
    },
  });
}

export function useUpdateExpense(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ expenseId, input }: { expenseId: string; input: Partial<ExpenseInput> }) =>
      updateExpense(workspaceId, expenseId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] }),
      ]);
    },
  });
}

export function useDeleteExpense(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (expenseId: string) => deleteExpense(workspaceId, expenseId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] }),
      ]);
    },
  });
}
