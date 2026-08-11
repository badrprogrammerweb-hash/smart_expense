import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CategoryList } from "@/components/category/CategoryList";
import type { MainCategory } from "@/lib/api/categories";
import { ApiError } from "@/lib/api/client";
import enMessages from "@/messages/en.json";

const updateCategoryMock = vi.hoisted(() => vi.fn());
const reorderCategoriesMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-categories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-categories")>();
  return {
    ...actual,
    useCategories: () => ({ data: { categories: tree }, isLoading: false, isError: false }),
    useUpdateCategory: () => ({ mutateAsync: updateCategoryMock, isPending: false }),
    useReorderCategories: () => ({ mutateAsync: reorderCategoriesMock, isPending: false }),
    useDeleteCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
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
    subcategories: [],
  },
  {
    id: "main-coffee",
    name: "Coffee",
    translation_key: null,
    is_system: false,
    parent_id: null,
    sort_order: 1,
    is_archived: false,
    subcategories: [],
  },
];

function renderList(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const DUPLICATE = "An active category already uses that name.";

function startRename(index = 0) {
  fireEvent.click(screen.getAllByRole("button", { name: "Rename" })[index]);
  return screen.getByLabelText("Rename category");
}

beforeEach(() => {
  updateCategoryMock.mockReset();
  reorderCategoriesMock.mockReset();
});

afterEach(() => {
  cleanup();
});

// The inline rename carried the same stale-error defect as BUG-08: the message
// described the name that was submitted, but survived every correction.
describe("inline category rename retires its stale error", () => {
  it("clears the rename error once the draft changes", async () => {
    updateCategoryMock.mockRejectedValue(new ApiError(409, "duplicate_category_name", "dup"));

    renderList(<CategoryList workspaceId="w1" role="owner" categoryType="expense" />);

    const input = startRename();
    fireEvent.change(input, { target: { value: "Coffee" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(DUPLICATE)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Rename category"), {
      target: { value: "Something Unique" },
    });

    await waitFor(() => expect(screen.queryByText(DUPLICATE)).not.toBeInTheDocument());
  });

  it("keeps the error while the submitted name is unchanged", async () => {
    updateCategoryMock.mockRejectedValue(new ApiError(409, "duplicate_category_name", "dup"));

    renderList(<CategoryList workspaceId="w1" role="owner" categoryType="expense" />);

    const input = startRename();
    fireEvent.change(input, { target: { value: "Coffee" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText(DUPLICATE);

    // Re-typing the same text is not a correction.
    fireEvent.change(screen.getByLabelText("Rename category"), { target: { value: "Coffee" } });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText(DUPLICATE)).toBeInTheDocument();
  });

  it("clears the empty-name validation message once a name is typed", async () => {
    renderList(<CategoryList workspaceId="w1" role="owner" categoryType="expense" />);

    const input = startRename();
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a category name.")).toBeInTheDocument();
    expect(updateCategoryMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Rename category"), { target: { value: "Brunch" } });

    await waitFor(() =>
      expect(screen.queryByText("Enter a category name.")).not.toBeInTheDocument(),
    );
  });

  it("still renames successfully and leaves no stale error behind", async () => {
    updateCategoryMock
      .mockRejectedValueOnce(new ApiError(409, "duplicate_category_name", "dup"))
      .mockResolvedValueOnce({ id: "main-restaurants", name: "Brunch" });

    renderList(<CategoryList workspaceId="w1" role="owner" categoryType="expense" />);

    const input = startRename();
    fireEvent.change(input, { target: { value: "Coffee" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText(DUPLICATE);

    fireEvent.change(screen.getByLabelText("Rename category"), { target: { value: "Brunch" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateCategoryMock).toHaveBeenLastCalledWith({
        categoryId: "main-restaurants",
        input: { name: "Brunch" },
      }),
    );
    // The editor closes on success, so the draft input is gone and no message
    // is left over from the earlier failure.
    await waitFor(() => expect(screen.queryByLabelText("Rename category")).not.toBeInTheDocument());
    expect(screen.queryByText(DUPLICATE)).not.toBeInTheDocument();
  });

  it("does not let typing a new name clear an unrelated row's failure", async () => {
    // A reorder failure is not about the draft, so editing a different row and
    // typing must leave it alone. (Pressing Rename itself has always reset the
    // row error — that predates this change and is not what is under test.)
    reorderCategoriesMock.mockRejectedValue(new ApiError(503, "database_unavailable", "down"));

    renderList(<CategoryList workspaceId="w1" role="owner" categoryType="expense" />);

    // Open the editor on the second row first...
    const input = startRename(1);

    // ...then fail a reorder on the first row, which is still showing actions.
    fireEvent.click(screen.getAllByRole("button", { name: "Move down" })[0]);
    const unrelated = "The service is temporarily unavailable. Try again shortly.";
    expect(await screen.findByText(unrelated)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Anything" } });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText(unrelated)).toBeInTheDocument();
  });
});
