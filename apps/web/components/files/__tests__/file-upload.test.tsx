import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileUpload } from "@/components/files/FileUpload";
import messages from "@/messages/en.json";

const uploadFileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/files", () => ({
  uploadFile: uploadFileMock,
}));

function renderWithProviders(ui: ReactNode, queryClient = new QueryClient()) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

function fileInput() {
  return screen.getByLabelText("Upload receipt or invoice") as HTMLInputElement;
}

describe("FileUpload", () => {
  beforeEach(() => {
    uploadFileMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("hides the upload control for viewers", () => {
    renderWithProviders(<FileUpload workspaceId="workspace-1" role="viewer" />);

    expect(screen.queryByLabelText("Upload receipt or invoice")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload file" })).not.toBeInTheDocument();
  });

  it("shows client-side validation messages", async () => {
    renderWithProviders(<FileUpload workspaceId="workspace-1" role="member" />);

    fireEvent.change(fileInput(), {
      target: { files: [new File(["not supported"], "receipt.exe", { type: "application/x-msdownload" })] },
    });

    expect(await screen.findByText("Upload a PNG, JPEG, WebP, or PDF file.")).toBeInTheDocument();
    expect(uploadFileMock).not.toHaveBeenCalled();
  });

  it("uploads a valid file and invalidates the file-list query", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const file = new File(["%PDF-1.7"], "receipt.pdf", { type: "application/pdf" });
    uploadFileMock.mockResolvedValue({
      id: "file-1",
      original_filename: "receipt.pdf",
      content_type: "application/pdf",
      size_bytes: file.size,
      expense_id: null,
      uploaded_by: "user-1",
      status: "active",
      created_at: "2026-07-03T00:00:00Z",
    });

    renderWithProviders(<FileUpload workspaceId="workspace-1" role="member" />, queryClient);

    fireEvent.change(fileInput(), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload file" }));

    await waitFor(() => expect(uploadFileMock).toHaveBeenCalledWith("workspace-1", { file }));
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["files", "workspace-1"] }),
    );
    expect(await screen.findByText("File uploaded.")).toBeInTheDocument();
  });

  // FR-018: upload progress must be shown with a descriptive label, not a bare
  // spinner against unchanged static text — a screen-reader user gets no signal
  // that anything is happening from a spinner alone, since it is aria-hidden.
  it("shows a descriptive uploading label while the request is in flight", async () => {
    let resolveUpload: (value: unknown) => void = () => undefined;
    uploadFileMock.mockReturnValue(new Promise((resolve) => { resolveUpload = resolve; }));
    const file = new File(["%PDF-1.7"], "receipt.pdf", { type: "application/pdf" });

    renderWithProviders(<FileUpload workspaceId="workspace-1" role="member" />);
    fireEvent.change(fileInput(), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload file" }));

    expect(await screen.findByRole("button", { name: "Uploading file..." })).toBeDisabled();

    resolveUpload({
      id: "file-1",
      original_filename: "receipt.pdf",
      content_type: "application/pdf",
      size_bytes: file.size,
      expense_id: null,
      uploaded_by: "user-1",
      status: "active",
      created_at: "2026-07-03T00:00:00Z",
    });
    expect(await screen.findByText("File uploaded.")).toBeInTheDocument();
  });
});
