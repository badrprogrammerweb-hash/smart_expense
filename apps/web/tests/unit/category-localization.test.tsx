import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HistoryList } from "@/components/history/HistoryList";
import { PlainLanguageSummary } from "@/components/reports/PlainLanguageSummary";
import type { MainCategory } from "@/lib/api/categories";
import type { ActivityHistoryItem } from "@/lib/api/history";
import type { SpendingSummary } from "@/lib/api/reports";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

// BUG-10: the same system category rendered in Arabic in pickers and
// breakdowns but in English in history detail and the spending-summary
// sentence, so a report sentence could not be matched to the category picked.
const getCategoriesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/categories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/categories")>();
  return { ...actual, getCategories: getCategoriesMock };
});

function mainCategory(overrides: Partial<MainCategory> & Pick<MainCategory, "id" | "name">): MainCategory {
  return {
    translation_key: null,
    is_system: false,
    parent_id: null,
    sort_order: 0,
    is_archived: false,
    subcategories: [],
    ...overrides,
  };
}

const expenseTree: MainCategory[] = [
  mainCategory({ id: "cat-education", name: "Education", translation_key: "education", is_system: true }),
  mainCategory({ id: "cat-travel", name: "Travel", translation_key: "travel", is_system: true }),
  // A category the user typed themselves: it has no translation key and must
  // read exactly as entered in every language.
  mainCategory({ id: "cat-coffee", name: "Coffee" }),
];

const incomeTree: MainCategory[] = [
  mainCategory({ id: "cat-family", name: "Family", translation_key: "family", is_system: true }),
];

function renderWithProviders(ui: ReactNode, locale: "en" | "ar") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? arMessages : enMessages}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

function historyItem(overrides: Partial<ActivityHistoryItem>): ActivityHistoryItem {
  return {
    id: "history-1",
    event_type: "category_created",
    actor_display_name: "Sara",
    created_at: "2026-08-07T09:00:00Z",
    summary: {},
    ...overrides,
  } as ActivityHistoryItem;
}

beforeEach(() => {
  getCategoriesMock.mockReset().mockImplementation(async (_workspaceId: string, categoryType: string) => ({
    categories: categoryType === "income" ? incomeTree : expenseTree,
  }));
});

afterEach(() => {
  cleanup();
});

describe("system category names are localized wherever they appear", () => {
  it("translates system category names in the Arabic activity history", async () => {
    renderWithProviders(
      <HistoryList
        workspaceId="workspace-1"
        locale="ar"
        items={[
          historyItem({ id: "h-1", summary: { name: "Education" } }),
          historyItem({ id: "h-2", summary: { name: "Travel" } }),
          historyItem({ id: "h-3", summary: { name: "Family" } }),
        ]}
      />,
      "ar",
    );

    expect(await screen.findAllByText(/التعليم/)).not.toHaveLength(0);
    expect(screen.getAllByText(/السفر/)).not.toHaveLength(0);
    // Income-tree categories resolve too — history covers both trees.
    expect(screen.getAllByText(/الأسرة/)).not.toHaveLength(0);

    const rendered = document.body.textContent ?? "";
    ["Education", "Travel", "Family"].forEach((english) => {
      expect(rendered).not.toContain(english);
    });
  });

  it("leaves a user-created category name exactly as the user entered it", async () => {
    renderWithProviders(
      <HistoryList
        workspaceId="workspace-1"
        locale="ar"
        items={[historyItem({ id: "h-4", summary: { name: "Coffee" } })]}
      />,
      "ar",
    );

    expect(await screen.findAllByText(/Coffee/)).not.toHaveLength(0);
  });

  it("does not translate names on non-category events", async () => {
    // `summaryText` also returns merchant names and workspace/AI settings.
    // Only a category event's name may be looked up in the catalog.
    renderWithProviders(
      <HistoryList
        workspaceId="workspace-1"
        locale="ar"
        items={[
          historyItem({
            id: "h-5",
            event_type: "expense_created",
            summary: { merchant_name: "Education" },
          }),
        ]}
      />,
      "ar",
    );

    expect(await screen.findAllByText(/Education/)).not.toHaveLength(0);
    expect(document.body.textContent ?? "").not.toContain("التعليم");
  });

  it("keeps a user-created name literal even when a system category shares it", async () => {
    getCategoriesMock.mockResolvedValue({
      categories: [
        mainCategory({ id: "sys", name: "Education", translation_key: "education", is_system: true }),
        mainCategory({ id: "own", name: "Education" }),
      ],
    });

    renderWithProviders(
      <HistoryList
        workspaceId="workspace-1"
        locale="ar"
        items={[historyItem({ id: "h-6", summary: { name: "Education" } })]}
      />,
      "ar",
    );

    // The name is ambiguous, so translating it could rename the user's own
    // category. Literal text is the safe reading.
    expect(await screen.findAllByText(/Education/)).not.toHaveLength(0);
  });

  it("localizes the top category in the Arabic spending summary sentence", async () => {
    const summary: SpendingSummary = {
      total_income_minor: 100000,
      total_expenses_minor: 35000,
      remaining_balance_minor: 65000,
      top_category: {
        category_id: "cat-education",
        category_name: "Education",
        total_minor: 25000,
        currency: "SAR",
      },
      trend_direction: "up",
      currency: "SAR",
    };

    renderWithProviders(
      <PlainLanguageSummary workspaceId="workspace-1" locale="ar" summary={summary} />,
      "ar",
    );

    expect(await screen.findByText(/التعليم/)).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toContain("Education");
  });

  it("localizes an uncategorized top category instead of printing the backend literal", async () => {
    const summary: SpendingSummary = {
      total_income_minor: 100000,
      total_expenses_minor: 35000,
      remaining_balance_minor: 65000,
      top_category: {
        category_id: null,
        category_name: "Uncategorized",
        total_minor: 25000,
        currency: "SAR",
      },
      trend_direction: "flat",
      currency: "SAR",
    };

    renderWithProviders(
      <PlainLanguageSummary workspaceId="workspace-1" locale="ar" summary={summary} />,
      "ar",
    );

    // The audit found "Uncategorized" in this sentence directly above the
    // breakdown card's "غير مصنف" for the same bucket.
    expect(await screen.findByText(/غير مصنف/)).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toContain("Uncategorized");
  });

  it("keeps a user-created top category name literal in the summary sentence", async () => {
    const summary: SpendingSummary = {
      total_income_minor: 100000,
      total_expenses_minor: 35000,
      remaining_balance_minor: 65000,
      top_category: {
        category_id: "cat-coffee",
        category_name: "Coffee",
        total_minor: 25000,
        currency: "SAR",
      },
      trend_direction: "flat",
      currency: "SAR",
    };

    renderWithProviders(
      <PlainLanguageSummary workspaceId="workspace-1" locale="ar" summary={summary} />,
      "ar",
    );

    expect(await screen.findByText(/Coffee/)).toBeInTheDocument();
  });
});
