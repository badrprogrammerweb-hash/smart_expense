import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExtractionReviewForm } from "@/components/extraction/ExtractionReviewForm";
import type { MainCategory } from "@/lib/api/categories";
import type { ExtractionRecord } from "@/lib/api/extractions";
import messages from "@/messages/en.json";

const confirmExtractionMock = vi.hoisted(() => vi.fn());
const getCategoriesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/extractions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/extractions")>();
  return {
    ...actual,
    confirmExtraction: confirmExtractionMock,
  };
});

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
    id: "cat-1",
    name: "Groceries",
    translation_key: "groceries",
    is_system: true,
    parent_id: null,
    sort_order: 0,
    is_archived: false,
    subcategories: [],
  },
];

const editableExtraction: ExtractionRecord = {
  id: "extraction-1",
  workspace_id: "workspace-1",
  file_id: "file-1",
  provider: "openai",
  status: "ready_for_review",
  draft: {
    amount_minor: 4250,
    extracted_currency: "USD",
    occurred_on: "2026-07-01",
    vendor_name: "Panda",
    suggested_category: "Groceries",
    suggested_category_id: null,
  },
  failure_reason: null,
  triggered_by: "user-1",
  triggered_at: "2026-07-04T10:00:00.000Z",
  confirmed_by: null,
  confirmed_at: null,
  discarded_by: null,
  discarded_at: null,
  expense_id: null,
  can_edit: true,
  can_discard: true,
};

describe("ExtractionReviewForm", () => {
  beforeEach(() => {
    confirmExtractionMock.mockReset();
    getCategoriesMock.mockReset();
    getCategoriesMock.mockResolvedValue({ categories: expenseTree });
  });

  afterEach(() => {
    cleanup();
  });

  it("submits corrected values to confirm the extraction", async () => {
    confirmExtractionMock.mockResolvedValue({ ...editableExtraction, status: "confirmed" });
    const onConfirmed = vi.fn();

    renderWithProviders(
      <ExtractionReviewForm
        currency="SAR"
        extraction={editableExtraction}
        onConfirmed={onConfirmed}
        workspaceId="workspace-1"
      />,
    );

    await screen.findByText("Groceries");

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "99.00" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-07-03" } });
    fireEvent.change(screen.getByLabelText("Vendor"), {
      target: { value: "Corrected Merchant" },
    });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "cat-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm extraction" }));

    await waitFor(() =>
      expect(confirmExtractionMock).toHaveBeenCalledWith("workspace-1", "extraction-1", {
        amountMinor: 9900,
        occurredOn: "2026-07-03",
        categoryId: "cat-1",
        merchantName: "Corrected Merchant",
        description: null,
      }),
    );
    expect(onConfirmed).toHaveBeenCalled();
  });

  it("pre-fills the category picker with the suggested category id", async () => {
    renderWithProviders(
      <ExtractionReviewForm
        currency="SAR"
        extraction={{
          ...editableExtraction,
          draft: { ...editableExtraction.draft!, suggested_category_id: "cat-1" },
        }}
        workspaceId="workspace-1"
      />,
    );

    await waitFor(() => {
      expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("cat-1");
    });
  });

  it("displays validation errors returned by the API", async () => {
    confirmExtractionMock.mockRejectedValue(new Error("Check the amount and date and try again."));

    renderWithProviders(
      <ExtractionReviewForm currency="SAR" extraction={editableExtraction} workspaceId="workspace-1" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm extraction" }));

    expect(await screen.findByText("Check the amount and date and try again.")).toBeInTheDocument();
  });

  it("renders read-only content when the caller cannot edit", () => {
    renderWithProviders(
      <ExtractionReviewForm
        currency="SAR"
        extraction={{ ...editableExtraction, can_edit: false, can_discard: false }}
        workspaceId="workspace-1"
      />,
    );

    expect(screen.getByText("Panda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm extraction" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument();
  });

  it("shows the auto-delete notice only when the workspace setting is enabled", () => {
    renderWithProviders(
      <ExtractionReviewForm
        autoDeleteAfterExtraction
        currency="SAR"
        extraction={editableExtraction}
        workspaceId="workspace-1"
      />,
    );

    expect(
      screen.getByText(
        "This file will be removed after you confirm, because auto-delete is on for this workspace.",
      ),
    ).toBeInTheDocument();
  });

  it("hides the auto-delete notice when the workspace setting is disabled", () => {
    renderWithProviders(
      <ExtractionReviewForm currency="SAR" extraction={editableExtraction} workspaceId="workspace-1" />,
    );

    expect(
      screen.queryByText(
        "This file will be removed after you confirm, because auto-delete is on for this workspace.",
      ),
    ).not.toBeInTheDocument();
  });
});
