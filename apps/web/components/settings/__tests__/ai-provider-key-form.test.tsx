import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiProviderKeyForm } from "@/components/settings/AiProviderKeyForm";
import type { AiSettingsStatus } from "@/lib/api/ai-settings";
import messages from "@/messages/en.json";

const putAiSettingsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/ai-settings", () => ({
  deleteAiSettings: vi.fn(),
  getAiSettings: vi.fn(),
  putAiSettings: putAiSettingsMock,
}));

const OPENAI_KEY = "sk-test-0000000000000000abcd";

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

function status(configured = false): AiSettingsStatus {
  return {
    configured,
    provider: configured ? "openai" : null,
    masked_hint: configured ? "••••abcd" : null,
    updated_at: configured ? "2026-07-04T10:00:00.000Z" : null,
    updated_by: configured ? "user-1" : null,
    updated_by_name: configured ? "Owner" : null,
  };
}

describe("AiProviderKeyForm", () => {
  beforeEach(() => {
    putAiSettingsMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("is hidden for non-owners", () => {
    renderWithProviders(
      <AiProviderKeyForm role="admin" status={status()} workspaceId="workspace-1" />,
    );

    expect(screen.queryByLabelText("API key")).not.toBeInTheDocument();
    expect(putAiSettingsMock).not.toHaveBeenCalled();
  });

  it("shows required and format validation before sending", () => {
    renderWithProviders(
      <AiProviderKeyForm role="owner" status={status()} workspaceId="workspace-1" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an API key.");

    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "bad-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use a key that matches the selected provider format.",
    );
    expect(putAiSettingsMock).not.toHaveBeenCalled();
  });

  it("clears the key and refreshes status after a successful save", async () => {
    const client = queryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    putAiSettingsMock.mockResolvedValue(status(true));

    renderWithProviders(
      <AiProviderKeyForm role="owner" status={status()} workspaceId="workspace-1" />,
      client,
    );

    fireEvent.change(screen.getByLabelText("API key"), { target: { value: OPENAI_KEY } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(putAiSettingsMock).toHaveBeenCalledWith("workspace-1", {
        provider: "openai",
        apiKey: OPENAI_KEY,
      }),
    );
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["ai-settings", "workspace-1"] }),
    );
    expect(screen.getByLabelText("API key")).toHaveValue("");
  });
});
