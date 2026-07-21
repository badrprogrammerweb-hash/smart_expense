import { apiFetch } from "./client";
import type { SupportedCurrency } from "../currency";

export type DashboardSummary = {
  total_income_minor: number;
  total_expenses_minor: number;
  remaining_balance_minor: number;
  currency: SupportedCurrency;
};

export type DashboardPeriod = {
  start: string;
  end: string;
};

export type CategoryBreakdownItem = {
  category_id: string | null;
  category_name: string;
  total_minor: number;
  currency: SupportedCurrency;
};

export type SubcategoryBreakdownItem = {
  subcategory_id: string | null;
  subcategory_name: string;
  total_minor: number;
  currency: SupportedCurrency;
};

export type RecentRecord = {
  type: "income" | "expense";
  id: string;
  amount_minor: number;
  currency: SupportedCurrency;
  occurred_on: string;
  description: string | null;
  merchant_name: string | null;
  category_id: string | null;
};

export type DashboardResponse = {
  workspace_id: string;
  period: DashboardPeriod;
  summary: DashboardSummary;
  category_breakdown: CategoryBreakdownItem[];
  recent_records: RecentRecord[];
  pending_ai_count: number;
};

export async function getDashboard(workspaceId: string, recentLimit?: number) {
  const params = new URLSearchParams();

  if (recentLimit !== undefined) {
    params.set("recent_limit", String(recentLimit));
  }

  const query = params.toString();
  return apiFetch<DashboardResponse>(`/workspaces/${workspaceId}/dashboard${query ? `?${query}` : ""}`);
}
