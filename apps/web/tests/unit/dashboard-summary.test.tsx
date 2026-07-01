import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { SummaryCards } from "@/components/dashboard/SummaryCards";
import messages from "@/messages/en.json";

const period = { start: "2026-07-01", end: "2026-07-31" };

function renderSummary(summary: {
  total_income_minor: number;
  total_expenses_minor: number;
  remaining_balance_minor: number;
  currency: "SAR";
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SummaryCards locale="en" period={period} summary={summary} />
    </NextIntlClientProvider>,
  );
}

describe("SummaryCards", () => {
  it("renders zero SAR figures with an empty-state message", () => {
    renderSummary({
      total_income_minor: 0,
      total_expenses_minor: 0,
      remaining_balance_minor: 0,
      currency: "SAR",
    });

    expect(screen.getAllByText(/SAR\s*0\.00/)).toHaveLength(3);
    expect(screen.getByText(/Add income or an expense/i)).toBeInTheDocument();
  });

  it("renders populated and negative SAR figures as returned by the backend", () => {
    renderSummary({
      total_income_minor: 10000,
      total_expenses_minor: 25000,
      remaining_balance_minor: -15000,
      currency: "SAR",
    });

    expect(screen.getByText(/SAR\s*100\.00/)).toBeInTheDocument();
    expect(screen.getByText(/SAR\s*250\.00/)).toBeInTheDocument();
    expect(screen.getByText(/SAR\s*-?150\.00|-SAR\s*150\.00/)).toBeInTheDocument();
  });
});
