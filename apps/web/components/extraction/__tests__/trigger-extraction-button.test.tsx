import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TriggerExtractionButton } from "@/components/extraction/TriggerExtractionButton";
import messages from "@/messages/en.json";

const triggerExtractionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/extractions", () => ({
  triggerExtraction: triggerExtractionMock,
}));

function renderWithProviders(ui: ReactNode, queryClient = new QueryClient()) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("TriggerExtractionButton", () => {
  beforeEach(() => {
    triggerExtractionMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("is hidden for a viewer", () => {
    renderWithProviders(
      <TriggerExtractionButton fileId="file-1" role="viewer" workspaceId="workspace-1" />,
    );

    expect(screen.queryByRole("button", { name: "Extract with AI" })).not.toBeInTheDocument();
  });

  it("shows a loading state for the duration of the call", async () => {
    const { promise, resolve } = deferred<{
      id: string;
      status: string;
      failure_reason: string | null;
    }>();
    triggerExtractionMock.mockReturnValue(promise);

    renderWithProviders(
      <TriggerExtractionButton fileId="file-1" role="member" workspaceId="workspace-1" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Extract with AI" }));

    expect(await screen.findByRole("button", { name: "Processing" })).toBeDisabled();

    resolve({ id: "extraction-1", status: "ready_for_review", failure_reason: null });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Extract with AI" })).not.toBeDisabled(),
    );
  });

  it("renders a ready_for_review result after a successful trigger", async () => {
    triggerExtractionMock.mockResolvedValue({
      id: "extraction-1",
      status: "ready_for_review",
      failure_reason: null,
    });

    renderWithProviders(
      <TriggerExtractionButton fileId="file-1" role="member" workspaceId="workspace-1" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Extract with AI" }));

    expect(await screen.findByText("Ready for review")).toBeInTheDocument();
    expect(triggerExtractionMock).toHaveBeenCalledWith("workspace-1", "file-1");
  });

  it("renders a failed result with its failure reason after a trigger", async () => {
    triggerExtractionMock.mockResolvedValue({
      id: "extraction-1",
      status: "failed",
      failure_reason: "invalid_key",
    });

    renderWithProviders(
      <TriggerExtractionButton fileId="file-1" role="owner" workspaceId="workspace-1" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Extract with AI" }));

    expect(
      await screen.findByText("The configured AI key was rejected by the provider."),
    ).toBeInTheDocument();
  });
});
