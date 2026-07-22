import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileList } from "@/components/files/FileList";
import messages from "@/messages/en.json";

const getFileDownloadUrlMock = vi.hoisted(() => vi.fn());
const deleteFileMock = vi.hoisted(() => vi.fn());
const listFilesMock = vi.hoisted(() => vi.fn());
const listExtractionsMock = vi.hoisted(() => vi.fn());
const triggerExtractionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/files", () => ({
  deleteFile: deleteFileMock,
  getFileDownloadUrl: getFileDownloadUrlMock,
  listFiles: listFilesMock,
}));

vi.mock("@/lib/api/extractions", () => ({
  listExtractions: listExtractionsMock,
  triggerExtraction: triggerExtractionMock,
}));

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

const receiptFile = {
  id: "file-1",
  original_filename: "receipt.pdf",
  content_type: "application/pdf",
  size_bytes: 2048,
  expense_id: "expense-123456789",
  uploaded_by: "user-1",
  status: "active",
  created_at: "2026-07-03T08:30:00.000Z",
};

describe("FileList", () => {
  beforeEach(() => {
    deleteFileMock.mockReset();
    getFileDownloadUrlMock.mockReset();
    listFilesMock.mockReset();
    listExtractionsMock.mockReset().mockResolvedValue([]);
    triggerExtractionMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders file metadata rows", async () => {
    listFilesMock.mockResolvedValue({ files: [receiptFile] });

    renderWithProviders(<FileList workspaceId="workspace-1" role="member" />);

    const desktopTable = await screen.findByRole("table", { name: "Files" });
    expect(within(desktopTable).getByText("receipt.pdf")).toBeInTheDocument();
    expect(within(desktopTable).getByText("application/pdf")).toBeInTheDocument();
    expect(within(desktopTable).getByText("2 KB")).toBeInTheDocument();
    expect(within(desktopTable).getByText("user-1")).toBeInTheDocument();
    expect(within(desktopTable).getByText("expense-")).toBeInTheDocument();
    expect(within(desktopTable).getByText("active")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    listFilesMock.mockResolvedValue({ files: [] });

    renderWithProviders(<FileList workspaceId="workspace-1" role="member" />);

    expect(await screen.findByText("No receipt or invoice files yet.")).toBeInTheDocument();
  });

  it("gets a signed URL before previewing or downloading a file", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    listFilesMock.mockResolvedValue({ files: [receiptFile] });
    getFileDownloadUrlMock.mockResolvedValue({
      url: "https://storage.example/signed/receipt.pdf",
      expires_in: 300,
    });

    renderWithProviders(<FileList workspaceId="workspace-1" role="member" />);

    fireEvent.click(await screen.findByRole("button", { name: "Preview receipt.pdf" }));

    await waitFor(() =>
      expect(getFileDownloadUrlMock).toHaveBeenCalledWith("workspace-1", "file-1"),
    );
    expect(openSpy).toHaveBeenCalledWith(
      "https://storage.example/signed/receipt.pdf",
      "_blank",
      "noopener,noreferrer",
    );

    fireEvent.click(screen.getByRole("button", { name: "Download receipt.pdf" }));

    await waitFor(() => expect(getFileDownloadUrlMock).toHaveBeenCalledTimes(2));
  });

  it("surfaces a failed extraction's classified reason with a retry action", async () => {
    const unlinkedFile = { ...receiptFile, id: "file-2", expense_id: null };
    listFilesMock.mockResolvedValue({ files: [unlinkedFile] });
    listExtractionsMock.mockResolvedValue([
      {
        id: "extraction-1",
        workspace_id: "workspace-1",
        file_id: "file-2",
        provider: "openai",
        status: "failed",
        draft: null,
        failure_reason: "invalid_key",
        triggered_by: "user-1",
        triggered_at: "2026-07-04T10:00:00.000Z",
        confirmed_by: null,
        confirmed_at: null,
        discarded_by: null,
        discarded_at: null,
        expense_id: null,
        can_edit: false,
        can_discard: true,
      },
    ]);

    renderWithProviders(<FileList workspaceId="workspace-1" role="member" />);

    expect(await screen.findByText("Failed")).toBeInTheDocument();
    expect(
      screen.getByText("The configured AI key was rejected by the provider."),
    ).toBeInTheDocument();
    // Retry reuses the same trigger control, never raw provider text.
    expect(screen.getByRole("button", { name: "Extract with AI" })).toBeInTheDocument();
  });
});
