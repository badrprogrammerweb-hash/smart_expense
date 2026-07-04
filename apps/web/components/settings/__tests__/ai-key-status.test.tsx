import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { AiKeyStatus } from "@/components/settings/AiKeyStatus";
import type { AiSettingsStatus } from "@/lib/api/ai-settings";
import messages from "@/messages/en.json";

function renderWithIntl(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("AiKeyStatus", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the not-configured state", () => {
    renderWithIntl(
      <AiKeyStatus
        status={{
          configured: false,
          provider: null,
          masked_hint: null,
          updated_at: null,
          updated_by: null,
          updated_by_name: null,
        }}
      />,
    );

    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(screen.getByText("No provider key is stored for this workspace.")).toBeInTheDocument();
  });

  it("renders provider and masked hint without rendering a full key", () => {
    const rawKey = "sk-test-0000000000000000abcd";
    const status = {
      configured: true,
      provider: "openai",
      masked_hint: "••••abcd",
      updated_at: "2026-07-04T10:00:00.000Z",
      updated_by: "user-1",
      updated_by_name: "Owner",
      api_key: rawKey,
    } as AiSettingsStatus & { api_key: string };

    renderWithIntl(<AiKeyStatus status={status} />);

    expect(screen.getByText("Configured")).toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("••••abcd")).toBeInTheDocument();
    expect(screen.queryByText(rawKey)).not.toBeInTheDocument();
    expect(screen.queryByText(rawKey.slice(0, -4))).not.toBeInTheDocument();
  });
});
