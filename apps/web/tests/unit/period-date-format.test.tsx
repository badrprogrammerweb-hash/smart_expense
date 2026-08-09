import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { PeriodSelector } from "@/components/reports/PeriodSelector";
import { ReportSummary } from "@/components/reports/ReportSummary";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

const reportPeriod = { preset: "current_month" as const, start: "2026-08-01", end: "2026-08-31" };

vi.mock("@/hooks/use-reports", () => ({
  useReports: () => ({
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    period: { period: "current_month" },
    setPeriod: vi.fn(),
    data: {
      workspace_id: "workspace-1",
      period: reportPeriod,
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
  useWorkspaceContext: () => ({ workspaceId: "workspace-1", role: "owner" }),
}));

vi.mock("@/hooks/use-categories", () => ({
  useCategories: () => ({ data: { categories: [] }, isLoading: false }),
}));

vi.mock("@/components/reports/AiSpendingSummary", () => ({
  AiSpendingSummary: () => null,
}));

// BUG-02: three date formats coexisted. The period card and subtitle printed
// the API's raw ISO string, while the rest of the product used DD/MM/YYYY —
// and a DD/MM/YYYY caption sat directly beneath each native date input, whose
// own rendering follows the browser/OS locale (MM/DD/YYYY on the audit
// machine), so the two lines showed different days for one value.
const ISO_DATE = /\d{4}-\d{2}-\d{2}/;

const period = { start: "2026-08-01", end: "2026-08-31" };
const summary = {
  total_income_minor: 10000,
  total_expenses_minor: 2500,
  remaining_balance_minor: 7500,
  currency: "SAR" as const,
};

function renderWithMessages(ui: ReactNode, locale: "en" | "ar" = "en") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? arMessages : enMessages}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("period surfaces use the product's date contract", () => {
  it("renders the dashboard period card as DD/MM/YYYY, not ISO", () => {
    renderWithMessages(<SummaryCards locale="en" period={period} summary={summary} />);

    expect(screen.getByText("01/08/2026 - 31/08/2026")).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(ISO_DATE);
  });

  it("renders the Arabic period card in the same format with the range in order", () => {
    renderWithMessages(<SummaryCards locale="ar" period={period} summary={summary} />, "ar");

    // The audit confirmed the RTL visual order of this range is already
    // correct, and it must not change. The DOM keeps start before end; the
    // browser's bidi algorithm handles the display, and `/` joins digits into
    // a single number run exactly as the previous `-` did.
    expect(screen.getByText("01/08/2026 - 31/08/2026")).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(ISO_DATE);
  });

  it("no longer prints a contradictory caption under the native date inputs", () => {
    renderWithMessages(
      <PeriodSelector value={{ period: "custom", start: "2026-08-07", end: "2026-08-20" }} onChange={vi.fn()} />,
    );

    // The controls keep their ISO machine values — that is what
    // `<input type="date">` requires and what is sent to the backend.
    expect((screen.getByLabelText("Start date") as HTMLInputElement).value).toBe("2026-08-07");
    expect((screen.getByLabelText("End date") as HTMLInputElement).value).toBe("2026-08-20");

    // ...but no second, differently-formatted rendering of the same value sits
    // beside them any more.
    expect(screen.queryByText("07/08/2026")).not.toBeInTheDocument();
    expect(screen.queryByText("20/08/2026")).not.toBeInTheDocument();
  });

  it("formats the Reports page subtitle instead of printing the API's ISO range", () => {
    renderWithMessages(<ReportSummary workspaceId="workspace-1" locale="en" />);

    expect(
      screen.getByText("Current period: 01/08/2026 to 31/08/2026"),
    ).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(ISO_DATE);
  });

  it("formats the Arabic Reports subtitle with no ISO date anywhere on the page", () => {
    renderWithMessages(<ReportSummary workspaceId="workspace-1" locale="ar" />, "ar");

    expect(screen.getByText("الفترة الحالية: 01/08/2026 إلى 31/08/2026")).toBeInTheDocument();
    // Covers the subtitle and the period card together — the audit found the
    // raw ISO range on both, on one screen.
    expect(document.body.textContent ?? "").not.toMatch(ISO_DATE);
  });

  it("keeps the machine values ISO in Arabic too", () => {
    renderWithMessages(
      <PeriodSelector value={{ period: "custom", start: "2026-08-07", end: "2026-08-20" }} onChange={vi.fn()} />,
      "ar",
    );

    expect((screen.getByLabelText("تاريخ البداية") as HTMLInputElement).value).toBe("2026-08-07");
    expect(screen.queryByText("07/08/2026")).not.toBeInTheDocument();
  });
});
