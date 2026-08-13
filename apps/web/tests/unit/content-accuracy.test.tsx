import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import type { RecentRecord } from "@/lib/api/dashboard";
import { getRoleLabel, getWorkspaceDisplayName } from "@/lib/i18n/workspace-labels";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

vi.mock("@/hooks/use-categories", () => ({
  useCategories: () => ({ data: { categories: [] }, isLoading: false }),
}));

function renderWith(ui: ReactNode, locale: "en" | "ar" = "en") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? arMessages : enMessages}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const period = { start: "2026-08-01", end: "2026-08-31" };
const summary = {
  total_income_minor: 100000,
  total_expenses_minor: 450000,
  remaining_balance_minor: -350000,
  currency: "SAR" as const,
};

afterEach(() => {
  cleanup();
});

// BUG-13: the negative card repeated its own label in red beneath the figure,
// so the most important number on the screen read like a rendering fault.
describe("remaining balance is labelled once", () => {
  it("shows the label once and explains the deficit instead of repeating it", () => {
    renderWith(<SummaryCards locale="en" period={period} summary={summary} />);

    expect(screen.getAllByText("Remaining balance")).toHaveLength(1);
    expect(screen.getByText("Expenses exceeded income in this period.")).toBeInTheDocument();
  });

  it("shows no deficit notice when the balance is positive", () => {
    renderWith(
      <SummaryCards
        locale="en"
        period={period}
        summary={{ ...summary, remaining_balance_minor: 50000 }}
      />,
    );

    expect(screen.getAllByText("Remaining balance")).toHaveLength(1);
    expect(screen.queryByText("Expenses exceeded income in this period.")).not.toBeInTheDocument();
  });

  it("labels it once in Arabic too", () => {
    renderWith(<SummaryCards locale="ar" period={period} summary={summary} />, "ar");

    expect(screen.getAllByText("الرصيد المتبقي")).toHaveLength(1);
    expect(screen.getByText("تجاوزت المصروفات الدخل في هذه الفترة.")).toBeInTheDocument();
  });
});

// BUG-11: one generic sentence — "Add income or an expense…" — was reused for
// every empty surface, so it told users to do something they had already done.
describe("empty states describe the data that is actually missing", () => {
  const GENERIC = /Add income or an expense/i;

  it("names the empty period on the summary banner instead of prescribing an action", () => {
    renderWith(
      <SummaryCards
        locale="en"
        period={period}
        summary={{ total_income_minor: 0, total_expenses_minor: 0, remaining_balance_minor: 0, currency: "SAR" }}
      />,
    );

    expect(screen.getByText(/Nothing was recorded between/i)).toBeInTheDocument();
    expect(screen.queryByText(GENERIC)).not.toBeInTheDocument();
  });

  it("lets a breakdown say which kind of data is missing", () => {
    renderWith(
      <CategoryBreakdown locale="en" items={[]} emptyDescription="No categorised income in this period." />,
    );

    expect(screen.getByText("No categorised income in this period.")).toBeInTheDocument();
    expect(screen.queryByText(GENERIC)).not.toBeInTheDocument();
  });

  it("falls back to a neutral period sentence, never the prescriptive one", () => {
    renderWith(<CategoryBreakdown locale="en" items={[]} />);

    expect(screen.getByText("No records in this period.")).toBeInTheDocument();
    expect(screen.queryByText(GENERIC)).not.toBeInTheDocument();
  });

  it("says recent activity is empty for the period rather than telling the user to start", () => {
    renderWith(<RecentActivity locale="en" records={[]} pendingAiCount={0} aiConfigured />);

    expect(screen.getByText("No records in this period yet.")).toBeInTheDocument();
    expect(screen.queryByText(GENERIC)).not.toBeInTheDocument();
  });
});

// BUG-16: a record saved without a description was titled with the raw enum,
// so the dashboard showed the lowercase token "income" — in Arabic too.
describe("a record with no description shows a localized type", () => {
  const record: RecentRecord = {
    id: "r1",
    type: "income",
    amount_minor: 100000,
    currency: "SAR",
    occurred_on: "2026-08-10",
    description: null,
    merchant_name: null,
    category_id: null,
  };

  it("renders the English type label, not the enum", () => {
    renderWith(<RecentActivity locale="en" records={[record]} pendingAiCount={0} aiConfigured />);

    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.queryByText("income")).not.toBeInTheDocument();
  });

  it("renders the Arabic type label, not the English enum", () => {
    renderWith(<RecentActivity locale="ar" records={[record]} pendingAiCount={0} aiConfigured />, "ar");

    expect(screen.getByText("دخل")).toBeInTheDocument();
    expect(screen.queryByText("income")).not.toBeInTheDocument();
  });

  it("still prefers a real description or merchant when present", () => {
    renderWith(
      <RecentActivity
        locale="en"
        records={[{ ...record, description: "Consulting fee" }]}
        pendingAiCount={0}
        aiConfigured
      />,
    );

    expect(screen.getByText("Consulting fee")).toBeInTheDocument();
  });
});

// BUG-14 / BUG-15: the stored role enum and the seeded workspace name were
// rendered raw, so Arabic screens carried untranslated English.
describe("role and workspace display names", () => {
  function labels(locale: "en" | "ar") {
    const messages = locale === "ar" ? arMessages : enMessages;
    // A stand-in for the `nav`-scoped translator the components pass in.
    return ((key: string) => (messages.nav as Record<string, string>)[key]) as never;
  }

  it("localizes every role in English", () => {
    const t = labels("en");
    expect(getRoleLabel(t, "owner")).toBe("Owner");
    expect(getRoleLabel(t, "admin")).toBe("Admin");
    expect(getRoleLabel(t, "member")).toBe("Member");
    expect(getRoleLabel(t, "viewer")).toBe("Viewer");
  });

  it("localizes every role in Arabic", () => {
    const t = labels("ar");
    expect(getRoleLabel(t, "owner")).toBe("مالك");
    expect(getRoleLabel(t, "admin")).toBe("مشرف");
    expect(getRoleLabel(t, "member")).toBe("عضو");
    expect(getRoleLabel(t, "viewer")).toBe("مشاهد");
  });

  it("localizes the seeded personal workspace only", () => {
    const ar = labels("ar");
    expect(getWorkspaceDisplayName(ar, { name: "Personal Workspace", type: "personal" })).toBe(
      "مساحة العمل الشخصية",
    );
  });

  it("leaves a user-chosen workspace name exactly as typed", () => {
    const ar = labels("ar");
    // Renamed personal workspace, and a team workspace: both are user-owned text.
    expect(getWorkspaceDisplayName(ar, { name: "ميزانيتي", type: "personal" })).toBe("ميزانيتي");
    expect(getWorkspaceDisplayName(ar, { name: "Household", type: "personal" })).toBe("Household");
    expect(getWorkspaceDisplayName(ar, { name: "Personal Workspace", type: "team" })).toBe(
      "Personal Workspace",
    );
  });
});
