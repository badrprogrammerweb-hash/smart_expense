"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createIncome, deleteIncome, listIncomes, updateIncome, type IncomeInput } from "@/lib/api/incomes";

export function useIncomes(workspaceId: string) {
  return useQuery({
    queryKey: ["incomes", workspaceId],
    queryFn: () => listIncomes(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateIncome(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: IncomeInput) => createIncome(workspaceId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["incomes", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] }),
      ]);
    },
  });
}

export function useUpdateIncome(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ incomeId, input }: { incomeId: string; input: Partial<IncomeInput> }) =>
      updateIncome(workspaceId, incomeId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["incomes", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] }),
      ]);
    },
  });
}

export function useDeleteIncome(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (incomeId: string) => deleteIncome(workspaceId, incomeId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["incomes", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] }),
      ]);
    },
  });
}
