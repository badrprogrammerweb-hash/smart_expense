import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AutoDeleteToggle } from "@/components/settings/AutoDeleteToggle";
import type { WorkspaceDetail, WorkspaceRole } from "@/lib/api/workspaces";
import messages from "@/messages/en.json";

const updateWorkspaceAutoDeleteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/workspaces", () => ({
  createWorkspace: vi.fn(),
  getWorkspace: vi.fn(),
  getWorkspaces: vi.fn(),
  updateWorkspaceAutoDelete: updateWorkspaceAutoDeleteMock,
}));

function renderWithProviders(ui: ReactNode, queryClient = new QueryClient()) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

function workspace(autoDeleteAfterExtraction: boolean): WorkspaceDetail {
  return {
    id: "workspace-1",
    type: "team",
    name: "Family Budget",
    role: "owner",
    member_count: 4,
    auto_delete_after_extraction: autoDeleteAfterExtraction,
  };
}

function toggle() {
  return screen.getByRole("checkbox", { name: "Auto-delete after extraction" });
}

describe("AutoDeleteToggle", () => {
  beforeEach(() => {
    updateWorkspaceAutoDeleteMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("is editable for owners and keeps the saved value displayed", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["workspace", "workspace-1"], workspace(false));
    updateWorkspaceAutoDeleteMock.mockResolvedValue({
      id: "workspace-1",
      auto_delete_after_extraction: true,
    });

    renderWithProviders(
      <AutoDeleteToggle
        autoDeleteAfterExtraction={false}
        role="owner"
        workspaceId="workspace-1"
      />,
      queryClient,
    );

    expect(toggle()).toBeEnabled();
    expect(toggle()).not.toBeChecked();

    fireEvent.click(toggle());

    await waitFor(() =>
      expect(updateWorkspaceAutoDeleteMock).toHaveBeenCalledWith("workspace-1", true),
    );
    expect(toggle()).toBeChecked();
    expect(
      queryClient.getQueryData<WorkspaceDetail>(["workspace", "workspace-1"])
        ?.auto_delete_after_extraction,
    ).toBe(true);
  });

  it("is read-only for admins, members, and viewers", () => {
    for (const role of ["admin", "member", "viewer"] as WorkspaceRole[]) {
      cleanup();

      renderWithProviders(
        <AutoDeleteToggle
          autoDeleteAfterExtraction={true}
          role={role}
          workspaceId="workspace-1"
        />,
      );

      expect(toggle()).toBeDisabled();
      expect(toggle()).toBeChecked();
    }

    expect(updateWorkspaceAutoDeleteMock).not.toHaveBeenCalled();
  });
});
