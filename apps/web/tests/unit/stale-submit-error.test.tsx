import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CategoryForm } from "@/components/category/CategoryForm";
import { IncomeForm } from "@/components/income/IncomeForm";
import { ApiError } from "@/lib/api/client";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

const createCategoryMock = vi.hoisted(() => vi.fn());
const createIncomeMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-categories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-categories")>();
  return {
    ...actual,
    useCategories: () => ({ data: { categories: [] }, isLoading: false }),
    useCreateCategory: () => ({ mutateAsync: createCategoryMock, isPending: false }),
  };
});

vi.mock("@/hooks/use-incomes", () => ({
  useCreateIncome: () => ({ mutateAsync: createIncomeMock, isPending: false }),
  useUpdateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function renderWith(ui: ReactNode, locale: "en" | "ar" = "en") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? arMessages : enMessages}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const DUPLICATE = "An active category already uses that name.";

beforeEach(() => {
  createCategoryMock.mockReset();
  createIncomeMock.mockReset();
});

afterEach(() => {
  cleanup();
});

// BUG-08: a server error is a statement about the values that were submitted.
// The duplicate-name message survived every correction until the next
// successful submit, so the user was told a corrected, unique name was still a
// duplicate — and briefly saw that beside "Enter a category name.", two
// mutually exclusive claims at once.
describe("a submit error retires once its values change", () => {
  it("clears the duplicate-name error when the name is corrected", async () => {
    createCategoryMock.mockRejectedValue(
      new ApiError(409, "duplicate_category_name", "duplicate"),
    );

    renderWith(<CategoryForm workspaceId="w1" role="owner" categoryType="expense" />);

    fireEvent.change(screen.getByLabelText("Category name"), {
      target: { value: "QA Test Category" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(DUPLICATE)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Category name"), {
      target: { value: "Something Unique" },
    });

    await waitFor(() => expect(screen.queryByText(DUPLICATE)).not.toBeInTheDocument());
  });

  it("never shows the stale server error beside a contradictory field error", async () => {
    createCategoryMock.mockRejectedValue(
      new ApiError(409, "duplicate_category_name", "duplicate"),
    );

    renderWith(<CategoryForm workspaceId="w1" role="owner" categoryType="expense" />);

    fireEvent.change(screen.getByLabelText("Category name"), {
      target: { value: "QA Test Category" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText(DUPLICATE);

    // Emptying the field is the audit's step 3, where both messages coexisted.
    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a category name.")).toBeInTheDocument();
    expect(screen.queryByText(DUPLICATE)).not.toBeInTheDocument();
  });

  it("keeps the error while the submitted values are unchanged", async () => {
    createCategoryMock.mockRejectedValue(
      new ApiError(409, "duplicate_category_name", "duplicate"),
    );

    renderWith(<CategoryForm workspaceId="w1" role="owner" categoryType="expense" />);

    const field = screen.getByLabelText("Category name");
    fireEvent.change(field, { target: { value: "QA Test Category" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText(DUPLICATE);

    // Re-typing the same text is not a correction: the message still describes
    // exactly what is in the form, so flushing it would hide live feedback.
    fireEvent.change(field, { target: { value: "QA Test Category" } });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText(DUPLICATE)).toBeInTheDocument();
  });

  it("applies the same rule to the income form's server errors", async () => {
    createIncomeMock.mockRejectedValue(new ApiError(503, "database_unavailable", "down"));

    renderWith(<IncomeForm workspaceId="w1" role="owner" currency="SAR" />);

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const message = "The service is temporarily unavailable. Try again shortly.";
    expect(await screen.findByText(message)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "20" } });

    await waitFor(() => expect(screen.queryByText(message)).not.toBeInTheDocument());
  });

  it("clears the stale error in Arabic too", async () => {
    createCategoryMock.mockRejectedValue(
      new ApiError(409, "duplicate_category_name", "duplicate"),
    );

    renderWith(<CategoryForm workspaceId="w1" role="owner" categoryType="expense" />, "ar");

    const arabicDuplicate = "يوجد تصنيف نشط يحمل هذا الاسم بالفعل.";
    fireEvent.change(screen.getByLabelText("اسم التصنيف"), { target: { value: "مكرر" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    expect(await screen.findByText(arabicDuplicate)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("اسم التصنيف"), { target: { value: "فريد" } });

    await waitFor(() => expect(screen.queryByText(arabicDuplicate)).not.toBeInTheDocument());
  });

  it("leaves field-level validation untouched", async () => {
    renderWith(<CategoryForm workspaceId="w1" role="owner" categoryType="expense" />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // A client-side rule is not a submit error and must keep behaving as before.
    expect(await screen.findByText("Enter a category name.")).toBeInTheDocument();
    expect(createCategoryMock).not.toHaveBeenCalled();
  });
});
