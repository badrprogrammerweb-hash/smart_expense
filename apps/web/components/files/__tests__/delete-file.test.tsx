import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileList } from "@/components/files/FileList";
import messages from "@/messages/en.json";

const deleteFileMock = vi.hoisted(() => vi.fn());
const getFileDownloadUrlMock = vi.hoisted(() => vi.fn());
const listFilesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/files", () => ({
  deleteFile: deleteFileMock,
  getFileDownloadUrl: getFileDownloadUrlMock,
  listFiles: listFilesMock,
}));

function renderWithProviders(ui: ReactNode, queryClient = new QueryClient()) {
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
  expense_id: null,
  uploaded_by: "user-1",
  status: "active",
  created_at: "2026-07-03T08:30:00.000Z",
};

describe("DeleteFileDialog", () => {
  beforeEach(() => {
    deleteFileMock.mockReset();
    getFileDownloadUrlMock.mockReset();
    listFilesMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("hides the delete control for members and viewers", async () => {
    for (const role of ["member", "viewer"] as const) {
      cleanup();
      listFilesMock.mockReset();
      listFilesMock.mockResolvedValue({ files: [receiptFile] });

      renderWithProviders(<FileList workspaceId="workspace-1" role={role} />);

      expect(await screen.findByText("receipt.pdf")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Delete file" })).not.toBeInTheDocument();
    }
  });

  it("shows a confirm flow for owners and removes the row after delete", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    listFilesMock.mockResolvedValueOnce({ files: [receiptFile] }).mockResolvedValue({ files: [] });
    deleteFileMock.mockResolvedValue({
      id: "file-1",
      status: "deleted",
      deleted_at: "2026-07-03T09:00:00.000Z",
    });

    renderWithProviders(<FileList workspaceId="workspace-1" role="owner" />, queryClient);

    fireEvent.click(await screen.findByRole("button", { name: "Delete file" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Confirm file deletion")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(deleteFileMock).toHaveBeenCalledWith("workspace-1", "file-1"));
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["files", "workspace-1"] }),
    );
    expect(await screen.findByText("No receipt or invoice files yet.")).toBeInTheDocument();
  });

  it("shows a confirm flow for admins", async () => {
    listFilesMock.mockResolvedValue({ files: [receiptFile] });

    renderWithProviders(<FileList workspaceId="workspace-1" role="admin" />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete file" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Confirm file deletion")).toBeInTheDocument();
  });
});
