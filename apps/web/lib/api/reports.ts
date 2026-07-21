import { apiFetch } from "./client";
import type { SupportedCurrency } from "../currency";
import type {
  CategoryBreakdownItem,
  DashboardSummary,
  RecentRecord,
  SubcategoryBreakdownItem,
} from "./dashboard";

export type ReportPeriodPreset = "current_month" | "previous_month" | "custom";

export type ReportPeriodInput =
  | { period: "current_month" | "previous_month"; start?: never; end?: never }
  | { period: "custom"; start: string; end: string };

export type ReportPeriod = {
  preset: ReportPeriodPreset | null;
  start: string;
  end: string;
};

export type TrendPoint = {
  bucket: string;
  granularity: "day" | "month";
  income_minor: number;
  expense_minor: number;
  remaining_minor: number;
  currency: SupportedCurrency;
};

export type MerchantTotal = {
  merchant_name: string;
  total_minor: number;
  count: number;
  currency: SupportedCurrency;
};

export type TeamActivityItem = {
  user_id: string;
  display_name: string | null;
  records_created: number;
};

export type SpendingSummary = {
  total_income_minor: number;
  total_expenses_minor: number;
  remaining_balance_minor: number;
  top_category: {
    category_id: string | null;
    category_name: string;
    total_minor: number;
    currency: SupportedCurrency;
  } | null;
  trend_direction: "up" | "down" | "flat";
  currency: SupportedCurrency;
};

export type AiSummaryLocale = "en" | "ar";

export type AiSummaryResponse = {
  locale: AiSummaryLocale;
  text: string;
};

export type ReportResponse = {
  workspace_id: string;
  period: ReportPeriod;
  summary: DashboardSummary;
  category_breakdown: CategoryBreakdownItem[];
  income_category_breakdown: CategoryBreakdownItem[];
  spending_trend: TrendPoint[];
  top_merchants: MerchantTotal[];
  recent_records: RecentRecord[];
  team_activity: TeamActivityItem[];
  pending_review_count: number;
  spending_summary: SpendingSummary;
};

export type SubcategoryDrilldownResponse = {
  main_category_id: string;
  main_category_name: string;
  subcategory_breakdown: SubcategoryBreakdownItem[];
};

export async function getReport(
  workspaceId: string,
  period: ReportPeriodInput = { period: "current_month" },
) {
  const params = new URLSearchParams({ period: period.period });

  if (period.period === "custom") {
    params.set("start", period.start);
    params.set("end", period.end);
  }

  return apiFetch<ReportResponse>(`/workspaces/${workspaceId}/reports?${params.toString()}`);
}

export async function getSubcategoryBreakdown(
  workspaceId: string,
  mainCategoryId: string,
  period: ReportPeriodInput = { period: "current_month" },
) {
  const params = new URLSearchParams({ period: period.period });

  if (period.period === "custom") {
    params.set("start", period.start);
    params.set("end", period.end);
  }

  return apiFetch<SubcategoryDrilldownResponse>(
    `/workspaces/${workspaceId}/reports/category-breakdown/${mainCategoryId}/subcategories?${params.toString()}`,
  );
}

export async function requestAiSummary(
  workspaceId: string,
  period: ReportPeriodInput,
  locale: AiSummaryLocale,
) {
  return apiFetch<AiSummaryResponse>(`/workspaces/${workspaceId}/reports/ai-summary`, {
    method: "POST",
    body: JSON.stringify({ ...period, locale }),
  });
}
