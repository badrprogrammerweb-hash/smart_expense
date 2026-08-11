import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CategoryList } from "@/components/category/CategoryList";
import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";
import type { MainCategory } from "@/lib/api/categories";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

const getCategoriesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/categories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/categories")>();
  return { ...actual, getCategories: getCategoriesMock };
});

vi.mock("@/lib/api/reports", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/reports")>();
  return { ...actual, getSubcategoryBreakdown: vi.fn().mockResolvedValue({ subcategory_breakdown: [] }) };
});

const tree: MainCategory[] = [
  {
    id: "main-restaurants",
    name: "Restaurants",
    translation_key: "restaurants",
    is_system: true,
    parent_id: null,
    sort_order: 0,
    is_archived: false,
    subcategories: [
      {
        id: "sub-dining",
        name: "Dining Out",
        translation_key: "restaurants.dining_out",
        is_system: true,
        parent_id: "main-restaurants",
        sort_order: 0,
        is_archived: false,
      },
    ],
  },
];

function renderWith(ui: ReactNode, locale: "en" | "ar" = "en") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? arMessages : enMessages}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  getCategoriesMock.mockReset().mockResolvedValue({ categories: tree });
});

afterEach(() => {
  cleanup();
});

// BUG-12: the chevron toggles were icon-only buttons with no text, no
// aria-label and no title — 18 unlabelled controls on the Categories page. A
// screen-reader user heard "button, button, button" and could not tell an
// expander from the reorder controls beside it, which made subcategories
// effectively unreachable.
describe("category disclosure controls are announceable", () => {
  it("names the collapsed toggle with its action and its category", async () => {
    renderWith(<CategoryList workspaceId="w1" role="owner" categoryType="expense" />);

    const toggle = await screen.findByRole("button", { name: "Show subcategories of Restaurants" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("swaps to the collapse wording once expanded", async () => {
    renderWith(<CategoryList workspaceId="w1" role="owner" categoryType="expense" />);

    const toggle = await screen.findByRole("button", { name: "Show subcategories of Restaurants" });
    fireEvent.click(toggle);

    const expanded = await screen.findByRole("button", { name: "Hide subcategories of Restaurants" });
    expect(expanded).toHaveAttribute("aria-expanded", "true");
  });

  it("uses the localized category name in Arabic", async () => {
    renderWith(<CategoryList workspaceId="w1" role="owner" categoryType="expense" />, "ar");

    // The name must come from the catalog, not the stored English text.
    const toggle = await screen.findByRole("button", { name: "عرض التصنيفات الفرعية لـ المطاعم" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(
      await screen.findByRole("button", { name: "إخفاء التصنيفات الفرعية لـ المطاعم" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("activates from the keyboard and reveals the subcategories", async () => {
    renderWith(<CategoryList workspaceId="w1" role="owner" categoryType="expense" />);

    const toggle = await screen.findByRole("button", { name: "Show subcategories of Restaurants" });
    toggle.focus();
    expect(toggle).toHaveFocus();

    // A native <button> maps Enter/Space to click; firing it is what the
    // browser does on key activation.
    fireEvent.click(toggle);

    expect(await screen.findByText("Dining Out")).toBeInTheDocument();
  });

  it("leaves no unnamed buttons on the categories list", async () => {
    const { container } = renderWith(
      <CategoryList workspaceId="w1" role="owner" categoryType="expense" />,
    );
    await screen.findByRole("button", { name: "Show subcategories of Restaurants" });

    const unnamed = Array.from(container.querySelectorAll("button")).filter(
      (b) => !(b.getAttribute("aria-label") || b.getAttribute("title") || b.textContent || "").trim(),
    );
    expect(unnamed).toHaveLength(0);
  });

  it("exposes expansion state on the report breakdown's drill-down control", async () => {
    renderWith(
      <CategoryBreakdown
        locale="en"
        workspaceId="w1"
        period={{ period: "current_month" }}
        items={[
          {
            category_id: "main-restaurants",
            category_name: "Restaurants",
            total_minor: 5000,
            currency: "SAR",
          },
        ]}
      />,
    );

    const row = await screen.findByRole("button", { name: /Restaurants/ });
    expect(row).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(row);
    await waitFor(() => expect(row).toHaveAttribute("aria-expanded", "true"));
  });

  it("does not claim expandability on a row that cannot drill down", async () => {
    renderWith(
      <CategoryBreakdown
        locale="en"
        items={[
          {
            category_id: null,
            category_name: "Uncategorized",
            total_minor: 5000,
            currency: "SAR",
          },
        ]}
      />,
    );

    const row = await screen.findByRole("button", { name: /Uncategorized/ });
    expect(row).toBeDisabled();
    expect(row).not.toHaveAttribute("aria-expanded");
  });
});
