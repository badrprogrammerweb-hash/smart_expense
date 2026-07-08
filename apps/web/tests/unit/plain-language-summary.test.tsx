import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { PlainLanguageSummary } from "@/components/reports/PlainLanguageSummary";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";
import type { SpendingSummary } from "@/lib/api/reports";

const summary: SpendingSummary = {
  total_income_minor: 100000,
  total_expenses_minor: 35000,
  remaining_balance_minor: 65000,
  top_category: {
    category_id: "category-1",
    category_name: "Groceries",
    total_minor: 25000,
    currency: "SAR",
  },
  trend_direction: "up",
  currency: "SAR",
};

function renderSummary(locale: "en" | "ar", value: SpendingSummary = summary) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? arMessages : enMessages}>
      <PlainLanguageSummary locale={locale} summary={value} />
    </NextIntlClientProvider>,
  );
}

describe("PlainLanguageSummary", () => {
  it("renders English totals, top category, and trend direction", () => {
    renderSummary("en");

    expect(screen.getByRole("heading", { name: "Spending summary" })).toBeInTheDocument();
    expect(screen.getByText(/SAR\s*1,000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/SAR\s*350\.00/)).toBeInTheDocument();
    expect(screen.getByText(/SAR\s*650\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Groceries/)).toBeInTheDocument();
    expect(screen.getByText(/increased/i)).toBeInTheDocument();
  });

  it("renders Arabic copy in RTL", () => {
    const { container } = renderSummary("ar");

    expect(container.firstElementChild).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("heading", { name: "ملخص الإنفاق" })).toBeInTheDocument();
    expect(screen.getByText(/Groceries/)).toBeInTheDocument();
    expect(screen.getByText(/زاد الإنفاق/)).toBeInTheDocument();
  });

  it("renders a neutral empty state", () => {
    renderSummary("en", {
      total_income_minor: 0,
      total_expenses_minor: 0,
      remaining_balance_minor: 0,
      top_category: null,
      trend_direction: "flat",
      currency: "SAR",
    });

    expect(screen.getByText("No confirmed records in this period yet.")).toBeInTheDocument();
  });
});
