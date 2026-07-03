import { apiFetch } from "./client";
import type { FileMetadata } from "./files";

export type ExpenseRecord = {
  id: string;
  amount_minor: number;
  currency: "SAR";
  occurred_on: string;
  category_id: string | null;
  description: string | null;
  merchant_name: string | null;
  status: "confirmed";
  created_by: string;
  created_at: string;
  updated_at: string;
  files?: FileMetadata[];
};

export type ExpenseInput = {
  amount_minor: number;
  occurred_on: string;
  category_id?: string | null;
  description?: string | null;
  merchant_name?: string | null;
};

export async function listExpenses(workspaceId: string) {
  return apiFetch<{ expenses: ExpenseRecord[] }>(`/workspaces/${workspaceId}/expenses`);
}

export async function createExpense(workspaceId: string, input: ExpenseInput) {
  return apiFetch<ExpenseRecord>(`/workspaces/${workspaceId}/expenses`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getExpense(workspaceId: string, expenseId: string) {
  return apiFetch<ExpenseRecord>(`/workspaces/${workspaceId}/expenses/${expenseId}`);
}

export async function updateExpense(workspaceId: string, expenseId: string, input: Partial<ExpenseInput>) {
  return apiFetch<ExpenseRecord>(`/workspaces/${workspaceId}/expenses/${expenseId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteExpense(workspaceId: string, expenseId: string) {
  return apiFetch<void>(`/workspaces/${workspaceId}/expenses/${expenseId}`, {
    method: "DELETE",
  });
}
