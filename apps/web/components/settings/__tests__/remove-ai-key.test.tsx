import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RemoveAiKeyDialog } from "@/components/settings/RemoveAiKeyDialog";
import type { AiSettingsStatus } from "@/lib/api/ai-settings";
import messages from "@/messages/en.json";

const deleteAiSettingsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/ai-settings", () => ({
  deleteAiSettings: deleteAiSettingsMock,
  getAiSettings: vi.fn(),
  putAiSettings: vi.fn(),
}));

function queryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: ReactNode, client = queryClient()) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const configuredStatus: AiSettingsStatus = {
  configured: true,
  provider: "openai",
  masked_hint: "••••abcd",
  updated_at: "2026-07-04T10:00:00.000Z",
  updated_by: "user-1",
  updated_by_name: "Owner",
};

const removedStatus: AiSettingsStatus = {
  configured: false,
  provider: null,
  masked_hint: null,
  updated_at: null,
  updated_by: null,
  updated_by_name: null,
};

describe("RemoveAiKeyDialog", () => {
  beforeEach(() => {
    deleteAiSettingsMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("hides the remove control for non-owners", () => {
    renderWithProviders(
      <RemoveAiKeyDialog configured={true} role="member" workspaceId="workspace-1" />,
    );

    expect(screen.queryByRole("button", { name: "Remove key" })).not.toBeInTheDocument();
  });

  it("shows owner confirm flow and updates status after removal", async () => {
    const client = queryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    client.setQueryData(["ai-settings", "workspace-1"], configuredStatus);
    deleteAiSettingsMock.mockResolvedValue(removedStatus);

    renderWithProviders(
      <RemoveAiKeyDialog configured={true} role="owner" workspaceId="workspace-1" />,
      client,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove key" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Remove AI key?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(deleteAiSettingsMock).toHaveBeenCalledWith("workspace-1"));
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["ai-settings", "workspace-1"] }),
    );
    expect(client.getQueryData<AiSettingsStatus>(["ai-settings", "workspace-1"])).toEqual(
      removedStatus,
    );
  });
});
