import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportSummary } from "@/components/reports/ReportSummary";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

const preset = vi.hoisted(() => ({ value: "current_month" as string | null }));

vi.mock("@/hooks/use-reports", () => ({
  useReports: () => ({
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    period: { period: "current_month" },
    setPeriod: vi.fn(),
    data: {
      workspace_id: "w1",
      period: { preset: preset.value, start: "2026-08-01", end: "2026-08-31" },
      summary: {
        total_income_minor: 10000,
        total_expenses_minor: 2500,
        remaining_balance_minor: 7500,
        currency: "SAR",
      },
      category_breakdown: [],
      income_category_breakdown: [],
      spending_trend: [],
      top_merchants: [],
      recent_records: [],
      team_activity: [],
      pending_review_count: 0,
      spending_summary: {
        total_income_minor: 10000,
        total_expenses_minor: 2500,
        remaining_balance_minor: 7500,
        top_category: null,
        trend_direction: "flat",
        currency: "SAR",
      },
    },
  }),
}));

vi.mock("@/lib/workspace-context", () => ({
  useWorkspaceContext: () => ({ workspaceId: "w1", role: "owner" }),
}));

vi.mock("@/hooks/use-categories", () => ({
  useCategories: () => ({ data: { categories: [] }, isLoading: false }),
}));

vi.mock("@/components/reports/AiSpendingSummary", () => ({ AiSpendingSummary: () => null }));

function renderReports(locale: "en" | "ar" = "en") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? arMessages : enMessages}>
      <QueryClientProvider client={queryClient}>
        <ReportSummary workspaceId="w1" locale={locale} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  preset.value = "current_month";
});

// BUG-21: every range was labelled "Current period" — including the previous
// month and custom ranges the user had explicitly just selected.
describe("the report period label matches the selected range", () => {
  it("names the current month", () => {
    preset.value = "current_month";
    renderReports();

    expect(screen.getByText("Current month: 01/08/2026 to 31/08/2026")).toBeInTheDocument();
    // Both the KPI card and the preset button read "Current month" here, which
    // is the point: the card now agrees with the control that produced it.
    expect(screen.getAllByText("Current month").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Current period/)).not.toBeInTheDocument();
  });

  it("names the previous month", () => {
    preset.value = "previous_month";
    renderReports();

    expect(screen.getByText("Previous month: 01/08/2026 to 31/08/2026")).toBeInTheDocument();
    expect(screen.queryByText(/Current period/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Current month:/)).not.toBeInTheDocument();
  });

  it("names a custom range", () => {
    preset.value = "custom";
    renderReports();

    expect(screen.getByText("Custom period: 01/08/2026 to 31/08/2026")).toBeInTheDocument();
    expect(screen.queryByText(/Current period/)).not.toBeInTheDocument();
  });

  it("treats an absent preset as the current month", () => {
    preset.value = null;
    renderReports();

    expect(screen.getByText("Current month: 01/08/2026 to 31/08/2026")).toBeInTheDocument();
  });

  it("localizes each label in Arabic", () => {
    preset.value = "previous_month";
    renderReports("ar");

    expect(screen.getByText("الشهر السابق: 01/08/2026 إلى 31/08/2026")).toBeInTheDocument();
    expect(screen.queryByText(/الفترة الحالية/)).not.toBeInTheDocument();
  });

  it("localizes a custom range in Arabic", () => {
    preset.value = "custom";
    renderReports("ar");

    expect(screen.getByText("فترة مخصصة: 01/08/2026 إلى 31/08/2026")).toBeInTheDocument();
    expect(screen.queryByText(/الفترة الحالية/)).not.toBeInTheDocument();
  });
});
