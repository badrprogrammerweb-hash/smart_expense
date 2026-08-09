// The default "today" in the record forms and the reports range picker used to
// be `new Date().toISOString().slice(0, 10)`, which truncates the UTC instant.
// In Asia/Riyadh (UTC+3) the UTC date LAGS the local date every local
// 00:00-02:59, so a form opened at 00:30 pre-filled *yesterday*.
process.env.TZ = "Asia/Riyadh";

import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExpenseForm } from "@/components/expense/ExpenseForm";
import { IncomeForm } from "@/components/income/IncomeForm";
import { PeriodSelector } from "@/components/reports/PeriodSelector";
import { formatDisplayDate, todayIsoDate } from "@/lib/format/date";
import messages from "@/messages/en.json";

vi.mock("@/hooks/use-incomes", () => ({
  useCreateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-expenses", () => ({
  useCreateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-categories", () => ({
  useCategories: () => ({ data: { categories: [] }, isLoading: false }),
}));

// 2026-08-09 00:30 Asia/Riyadh is 2026-08-08 21:30 UTC.
const RIYADH_JUST_AFTER_MIDNIGHT = new Date("2026-08-08T21:30:00Z");

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function renderAtRiyadhMidnight(ui: React.ReactNode) {
  vi.useFakeTimers();
  vi.setSystemTime(RIYADH_JUST_AFTER_MIDNIGHT);

  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("todayIsoDate", () => {
  it("verifies the suite is actually running in Asia/Riyadh", () => {
    // Guard: without this the timezone-sensitive assertions below could pass
    // for the wrong reason on a machine that ignored the TZ setting.
    expect(RIYADH_JUST_AFTER_MIDNIGHT.getTimezoneOffset()).toBe(-180);
    expect(RIYADH_JUST_AFTER_MIDNIGHT.toISOString().slice(0, 10)).toBe("2026-08-08");
  });

  it("returns the local calendar day shortly after midnight in Riyadh", () => {
    vi.useFakeTimers();
    vi.setSystemTime(RIYADH_JUST_AFTER_MIDNIGHT);

    expect(todayIsoDate()).toBe("2026-08-09");
  });

  it("does not reproduce the UTC truncation it replaces", () => {
    vi.useFakeTimers();
    vi.setSystemTime(RIYADH_JUST_AFTER_MIDNIGHT);

    expect(todayIsoDate()).not.toBe(new Date().toISOString().slice(0, 10));
  });

  it("agrees with itself across the whole 00:00-02:59 Riyadh window", () => {
    // 21:00, 22:00 and 23:00 UTC are 00:00, 01:00 and 02:00 local on the 9th.
    ["21:00", "22:30", "23:59"].forEach((utcTime) => {
      expect(todayIsoDate(new Date(`2026-08-08T${utcTime}:00Z`))).toBe("2026-08-09");
    });
  });

  it("is unchanged for a time of day where local and UTC already agree", () => {
    expect(todayIsoDate(new Date("2026-08-09T09:00:00Z"))).toBe("2026-08-09");
  });

  it("pads single-digit months and days", () => {
    expect(todayIsoDate(new Date("2026-01-04T09:00:00Z"))).toBe("2026-01-04");
  });

  it("names the same day the display formatter renders for it", () => {
    // A default date and its rendering must not disagree — that pairing is
    // what BUG-02 was about.
    const iso = todayIsoDate(RIYADH_JUST_AFTER_MIDNIGHT);

    expect(formatDisplayDate(iso)).toBe("09/08/2026");
    expect(formatDisplayDate(RIYADH_JUST_AFTER_MIDNIGHT)).toBe("09/08/2026");
  });

  it("rejects an invalid date rather than emitting NaN components", () => {
    expect(() => todayIsoDate(new Date("nonsense"))).toThrow(RangeError);
  });
});

describe("default dates at 00:30 Asia/Riyadh use the local calendar day", () => {
  it("pre-fills the income form with today, not yesterday", () => {
    renderAtRiyadhMidnight(<IncomeForm workspaceId="workspace-1" role="owner" currency="SAR" />);

    expect(screen.getByLabelText("Date")).toHaveValue("2026-08-09");
  });

  it("pre-fills the expense form with today, not yesterday", () => {
    renderAtRiyadhMidnight(<ExpenseForm workspaceId="workspace-1" role="member" currency="SAR" />);

    expect(screen.getByLabelText("Date")).toHaveValue("2026-08-09");
  });

  it("seeds the reports custom range from today, not yesterday", () => {
    // A preset period carries no dates of its own, so the custom range inputs
    // fall back to "today" on both ends.
    renderAtRiyadhMidnight(<PeriodSelector value={{ period: "current_month" }} onChange={vi.fn()} />);

    expect(screen.getByLabelText("Start date")).toHaveValue("2026-08-09");
    expect(screen.getByLabelText("End date")).toHaveValue("2026-08-09");
  });
});
