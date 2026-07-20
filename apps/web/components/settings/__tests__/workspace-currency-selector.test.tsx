import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceCurrencySelector } from "@/components/settings/WorkspaceCurrencySelector";
import type { WorkspaceDetail } from "@/lib/api/workspaces";
import messages from "@/messages/en.json";

const updateWorkspaceCurrencyMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/workspaces", () => ({
  createWorkspace: vi.fn(),
  getWorkspace: vi.fn(),
  getWorkspaces: vi.fn(),
  updateWorkspaceAutoDelete: vi.fn(),
  updateWorkspaceCurrency: updateWorkspaceCurrencyMock,
}));

function renderWithProviders(ui: ReactNode, queryClient = new QueryClient()) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

function workspace(currency: WorkspaceDetail["currency"], currencyLocked: boolean): WorkspaceDetail {
  return {
    id: "workspace-1",
    type: "team",
    name: "Family Budget",
    role: "owner",
    member_count: 4,
    currency,
    currency_locked: currencyLocked,
    auto_delete_after_extraction: false,
  };
}

function selector() {
  return screen.getByRole("combobox", { name: "Base currency" });
}

describe("WorkspaceCurrencySelector", () => {
  beforeEach(() => {
    updateWorkspaceCurrencyMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("lets owners change currency before the workspace is locked", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["workspace", "workspace-1"], workspace("SAR", false));
    updateWorkspaceCurrencyMock.mockResolvedValue({
      id: "workspace-1",
      currency: "USD",
      auto_delete_after_extraction: false,
    });

    renderWithProviders(
      <WorkspaceCurrencySelector
        currency="SAR"
        currencyLocked={false}
        role="owner"
        workspaceId="workspace-1"
      />,
      queryClient,
    );

    expect(selector()).toBeEnabled();

    fireEvent.change(selector(), { target: { value: "USD" } });

    await waitFor(() =>
      expect(updateWorkspaceCurrencyMock).toHaveBeenCalledWith("workspace-1", "USD"),
    );
    expect(queryClient.getQueryData<WorkspaceDetail>(["workspace", "workspace-1"])?.currency).toBe(
      "USD",
    );
  });

  it("is disabled for non-owners and locked workspaces", () => {
    renderWithProviders(
      <WorkspaceCurrencySelector
        currency="SAR"
        currencyLocked={false}
        role="admin"
        workspaceId="workspace-1"
      />,
    );
    expect(selector()).toBeDisabled();
    expect(screen.getByText("Only the workspace owner can change the base currency.")).toBeVisible();

    cleanup();

    renderWithProviders(
      <WorkspaceCurrencySelector
        currency="SAR"
        currencyLocked={true}
        role="owner"
        workspaceId="workspace-1"
      />,
    );
    expect(selector()).toBeDisabled();
    expect(
      screen.getByText("Currency is locked once this workspace has an income or expense record."),
    ).toBeVisible();
  });
});
