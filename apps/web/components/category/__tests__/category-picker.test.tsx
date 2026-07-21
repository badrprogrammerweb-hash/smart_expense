import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoryPicker } from "@/components/category/CategoryPicker";
import type { MainCategory } from "@/lib/api/categories";
import messages from "@/messages/en.json";

const getCategoriesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/categories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/categories")>();
  return {
    ...actual,
    getCategories: getCategoriesMock,
  };
});

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const expenseTree: MainCategory[] = [
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
        id: "sub-dining-out",
        name: "Dining Out",
        translation_key: "restaurants.dining_out",
        is_system: true,
        parent_id: "main-restaurants",
        sort_order: 0,
        is_archived: false,
      },
    ],
  },
  {
    id: "main-rent",
    name: "Rent",
    translation_key: "rent",
    is_system: true,
    parent_id: null,
    sort_order: 1,
    is_archived: false,
    subcategories: [],
  },
];

describe("CategoryPicker", () => {
  afterEach(() => {
    cleanup();
    getCategoriesMock.mockReset();
  });

  it("clears the selected subcategory when the main category changes", async () => {
    getCategoriesMock.mockResolvedValue({ categories: expenseTree });
    const onChange = vi.fn();

    renderWithProviders(
      <CategoryPicker
        workspaceId="workspace-1"
        categoryType="expense"
        value="sub-dining-out"
        onChange={onChange}
      />,
    );

    await screen.findByText("Rent");

    const mainSelect = screen.getByLabelText("Category") as HTMLSelectElement;
    const subSelect = screen.getByLabelText("Subcategory") as HTMLSelectElement;
    expect(mainSelect.value).toBe("main-restaurants");
    expect(subSelect.value).toBe("sub-dining-out");

    fireEvent.change(mainSelect, { target: { value: "main-rent" } });

    expect(onChange).toHaveBeenCalledWith("main-rent");
  });

  it("selecting a subcategory reports the subcategory id", async () => {
    getCategoriesMock.mockResolvedValue({ categories: expenseTree });
    const onChange = vi.fn();

    renderWithProviders(
      <CategoryPicker
        workspaceId="workspace-1"
        categoryType="expense"
        value="main-restaurants"
        onChange={onChange}
      />,
    );

    await screen.findByText("Dining Out");

    const subSelect = screen.getByLabelText("Subcategory") as HTMLSelectElement;
    fireEvent.change(subSelect, { target: { value: "sub-dining-out" } });

    expect(onChange).toHaveBeenCalledWith("sub-dining-out");
  });

  it("disables the subcategory select when the chosen main has none", async () => {
    getCategoriesMock.mockResolvedValue({ categories: expenseTree });

    renderWithProviders(
      <CategoryPicker
        workspaceId="workspace-1"
        categoryType="expense"
        value="main-rent"
        onChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("main-rent");
    });

    const subSelect = screen.getByLabelText("Subcategory") as HTMLSelectElement;
    expect(subSelect.disabled).toBe(true);
  });
});
