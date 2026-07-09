import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AiSpendingSummary } from "@/components/reports/AiSpendingSummary";
import { ApiError } from "@/lib/api/client";
import type { ReportPeriodInput } from "@/lib/api/reports";
import enMessages from "@/messages/en.json";

vi.mock("@/hooks/use-ai-settings", () => ({
  useAiSettings: vi.fn(),
}));

vi.mock("@/lib/api/reports", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/reports")>();
  return {
    ...actual,
    requestAiSummary: vi.fn(),
  };
});

import { useAiSettings } from "@/hooks/use-ai-settings";
import { requestAiSummary } from "@/lib/api/reports";

const mockedUseAiSettings = vi.mocked(useAiSettings);
const mockedRequestAiSummary = vi.mocked(requestAiSummary);

const period: ReportPeriodInput = { period: "current_month" };

function renderSummary(role: "owner" | "admin" | "member" | "viewer") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <AiSpendingSummary
          locale="en"
          period={period}
          role={role}
          workspaceId="workspace-1"
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("AiSpendingSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is absent when no BYOK key is configured", () => {
    mockedUseAiSettings.mockReturnValue({
      data: { configured: false },
      isLoading: false,
    } as ReturnType<typeof useAiSettings>);

    renderSummary("owner");

    expect(screen.queryByRole("button", { name: "Generate AI summary" })).not.toBeInTheDocument();
  });

  it("is absent for Viewer even when BYOK is configured", () => {
    mockedUseAiSettings.mockReturnValue({
      data: { configured: true },
      isLoading: false,
    } as ReturnType<typeof useAiSettings>);

    renderSummary("viewer");

    expect(screen.queryByRole("button", { name: "Generate AI summary" })).not.toBeInTheDocument();
  });

  it("shows a safe error state when the request fails", async () => {
    mockedUseAiSettings.mockReturnValue({
      data: { configured: true },
      isLoading: false,
    } as ReturnType<typeof useAiSettings>);
    mockedRequestAiSummary.mockRejectedValue(
      new ApiError(502, "ai_provider_error", "raw provider details"),
    );

    renderSummary("member");
    fireEvent.click(screen.getByRole("button", { name: "Generate AI summary" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "The AI summary could not be generated. The rest of the report is still available.",
        ),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("raw provider details")).not.toBeInTheDocument();
  });
});
