import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { AiKeyStatus } from "@/components/settings/AiKeyStatus";
import messages from "@/messages/en.json";

describe("AiKeyStatus", () => {
  it("renders only a masked suffix and never the supplied key hint", () => {
    const fullHint = "sk-super-secret-token-1234";
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AiKeyStatus status={{ configured: true, provider: "openai", masked_hint: fullHint, updated_at: null, updated_by: null, updated_by_name: null }} />
      </NextIntlClientProvider>,
    );

    expect(screen.queryByText(fullHint)).not.toBeInTheDocument();
    expect(screen.getByText("****1234")).toBeVisible();
  });
});
