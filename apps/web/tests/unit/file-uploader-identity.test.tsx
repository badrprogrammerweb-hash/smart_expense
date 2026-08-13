import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileList } from "@/components/files/FileList";
import { ExpenseHistoryList } from "@/components/expense/ExpenseHistoryList";
import { IncomeHistoryList } from "@/components/income/IncomeHistoryList";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

const listFilesMock = vi.hoisted(() => vi.fn());
const listExtractionsMock = vi.hoisted(() => vi.fn());
const getWorkspaceMembersMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/files", () => ({
  deleteFile: vi.fn(),
  getFileDownloadUrl: vi.fn(),
  listFiles: listFilesMock,
}));
vi.mock("@/lib/api/extractions", () => ({
  listExtractions: listExtractionsMock,
  triggerExtraction: vi.fn(),
}));
vi.mock("@/lib/api/workspace-members", () => ({ getWorkspaceMembers: getWorkspaceMembersMock }));
vi.mock("@/hooks/use-incomes", () => ({
  useIncomes: () => ({ data: { incomes: [] }, isLoading: false, isError: false, refetch: vi.fn() }),
  useDeleteIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/use-expenses", () => ({
  useExpenses: () => ({ data: { expenses: [] }, isLoading: false, isError: false, refetch: vi.fn() }),
  useDeleteExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/use-categories", () => ({
  useCategories: () => ({ data: { categories: [] }, isLoading: false }),
}));
vi.mock("@/lib/workspace-context", () => ({
  useWorkspaceContext: () => ({ workspaceId: "w1", role: "owner", currency: "SAR" }),
}));

const UPLOADER_ID = "75f9da1b-2eec-4401-806e-a63a9a1dfa03";

const file = {
  id: "file-1",
  original_filename: "a-very-long-scanned-receipt-filename-from-the-phone-camera.pdf",
  content_type: "application/pdf",
  size_bytes: 2048,
  expense_id: null,
  uploaded_by: UPLOADER_ID,
  status: "active" as const,
  created_at: "2026-08-10T09:00:00Z",
  deleted_at: null,
  deleted_by: null,
};

function renderWith(ui: ReactNode, locale: "en" | "ar" = "en") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? arMessages : enMessages}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  listFilesMock.mockReset().mockResolvedValue({ files: [file] });
  listExtractionsMock.mockReset().mockResolvedValue([]);
  getWorkspaceMembersMock
    .mockReset()
    .mockResolvedValue({ members: [{ user_id: UPLOADER_ID, email: "sara@example.com", role: "owner" }] });
});

afterEach(() => {
  cleanup();
});

// BUG-20: the Uploader column showed a raw UUID, so the one column that exists
// to answer "who uploaded this?" could not answer it. The Status column showed
// the raw lowercase enum.
describe("the files table identifies people, not identifiers", () => {
  it("shows the uploader's e-mail instead of the stored user id", async () => {
    renderWith(<FileList workspaceId="w1" role="owner" />);

    const table = await screen.findByRole("table", { name: "Files" });
    expect(await within(table).findByText("sara@example.com")).toBeInTheDocument();
    expect(within(table).queryByText(UPLOADER_ID)).not.toBeInTheDocument();
  });

  it("never renders a UUID anywhere in the table", async () => {
    renderWith(<FileList workspaceId="w1" role="owner" />);

    const table = await screen.findByRole("table", { name: "Files" });
    await within(table).findByText("sara@example.com");

    expect(table.textContent ?? "").not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    );
  });

  it("falls back safely when the uploader is no longer a member", async () => {
    // A file outlives its uploader's membership; the id must not leak instead.
    getWorkspaceMembersMock.mockResolvedValue({ members: [] });
    renderWith(<FileList workspaceId="w1" role="owner" />);

    const table = await screen.findByRole("table", { name: "Files" });
    expect(await within(table).findByText("Unknown")).toBeInTheDocument();
    expect(within(table).queryByText(UPLOADER_ID)).not.toBeInTheDocument();
  });

  it("localizes the status enum", async () => {
    renderWith(<FileList workspaceId="w1" role="owner" />);

    const table = await screen.findByRole("table", { name: "Files" });
    expect(within(table).getByText("Active")).toBeInTheDocument();
    expect(within(table).queryByText("active")).not.toBeInTheDocument();
  });

  it("localizes the status and uploader fallback in Arabic", async () => {
    getWorkspaceMembersMock.mockResolvedValue({ members: [] });
    renderWith(<FileList workspaceId="w1" role="owner" />, "ar");

    const table = await screen.findByRole("table", { name: "الملفات" });
    expect(await within(table).findByText("غير معروف")).toBeInTheDocument();
    expect(within(table).getByText("نشط")).toBeInTheDocument();
  });

  it("keeps showing the original filename, however long", async () => {
    renderWith(<FileList workspaceId="w1" role="owner" />);

    const table = await screen.findByRole("table", { name: "Files" });
    expect(within(table).getByText(file.original_filename)).toBeInTheDocument();
  });
});

// BUG-19: the empty and error states used one sentence as both the heading and
// the description, wasting the line that should say what to do next.
describe("empty states do not repeat themselves", () => {
  it("gives the income empty state a distinct heading and guidance", () => {
    renderWith(<IncomeHistoryList workspaceId="w1" role="owner" />);

    expect(screen.getByText("No income yet.")).toBeInTheDocument();
    expect(screen.getByText("Add your first income record using the form above.")).toBeInTheDocument();
    expect(screen.getAllByText("No income yet.")).toHaveLength(1);
  });

  it("gives the expense empty state a distinct heading and guidance", () => {
    renderWith(<ExpenseHistoryList workspaceId="w1" role="owner" />);

    expect(screen.getAllByText("No expenses yet.")).toHaveLength(1);
    expect(screen.getByText("Add your first expense using the form above.")).toBeInTheDocument();
  });

  it("does not repeat the heading in Arabic either", () => {
    renderWith(<IncomeHistoryList workspaceId="w1" role="owner" />, "ar");

    expect(screen.getAllByText("لا يوجد دخل بعد.")).toHaveLength(1);
    expect(screen.getByText("أضف أول سجل دخل باستخدام النموذج أعلاه.")).toBeInTheDocument();
  });
});
