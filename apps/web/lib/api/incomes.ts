import { apiFetch } from "./client";
import type { SupportedCurrency } from "../currency";

export type IncomeRecord = {
  id: string;
  amount_minor: number;
  currency: SupportedCurrency;
  occurred_on: string;
  description: string | null;
  category_id: string | null;
  status: "confirmed";
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type IncomeInput = {
  amount_minor: number;
  occurred_on: string;
  description?: string | null;
  category_id?: string | null;
};

export async function listIncomes(workspaceId: string) {
  return apiFetch<{ incomes: IncomeRecord[] }>(`/workspaces/${workspaceId}/incomes`);
}

export async function createIncome(workspaceId: string, input: IncomeInput) {
  return apiFetch<IncomeRecord>(`/workspaces/${workspaceId}/incomes`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getIncome(workspaceId: string, incomeId: string) {
  return apiFetch<IncomeRecord>(`/workspaces/${workspaceId}/incomes/${incomeId}`);
}

export async function updateIncome(workspaceId: string, incomeId: string, input: Partial<IncomeInput>) {
  return apiFetch<IncomeRecord>(`/workspaces/${workspaceId}/incomes/${incomeId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteIncome(workspaceId: string, incomeId: string) {
  return apiFetch<void>(`/workspaces/${workspaceId}/incomes/${incomeId}`, {
    method: "DELETE",
  });
}
