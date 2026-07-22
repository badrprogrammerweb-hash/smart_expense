import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { SpendingTrendChart } from "@/components/reports/SpendingTrendChart";
import type { TrendPoint } from "@/lib/api/reports";
import messages from "@/messages/en.json";

function renderWithProviders(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const basePoint = {
  income_minor: 100_000,
  expense_minor: 40_000,
  remaining_minor: 60_000,
  currency: "SAR",
} as const;

describe("SpendingTrendChart", () => {
  it("renders a day-granularity bucket as DD/MM/YYYY", () => {
    const points: TrendPoint[] = [{ ...basePoint, bucket: "2026-07-13", granularity: "day" }];
    renderWithProviders(<SpendingTrendChart points={points} locale="en" />);

    expect(screen.getByText("13/07/2026")).toBeVisible();
  });

  it("renders a month-granularity bucket without crashing (backend already sends the first-of-month date)", () => {
    // Regression guard: the backend truncates month buckets to the first day
    // (date_trunc('month', ...)::date), so `point.bucket` is already a
    // complete YYYY-MM-DD string. Appending an extra day segment produced an
    // invalid date string that made formatDisplayDate throw, crashing the
    // Reports screen whenever monthly-granularity trend data was present.
    const points: TrendPoint[] = [{ ...basePoint, bucket: "2026-07-01", granularity: "month" }];

    expect(() => renderWithProviders(<SpendingTrendChart points={points} locale="en" />)).not.toThrow();
    expect(screen.getByText("01/07/2026")).toBeVisible();
  });
});
