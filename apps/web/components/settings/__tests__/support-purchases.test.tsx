import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SupportPurchaseCard } from "@/components/settings/SupportPurchaseCard";
import { SupportPurchaseResult } from "@/components/settings/SupportPurchaseResult";
import { SupportTierSelector } from "@/components/settings/SupportTierSelector";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";


const getWebSupportPurchaseMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/support-purchases", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/support-purchases")>();
  return {
    ...actual,
    getWebSupportPurchase: getWebSupportPurchaseMock,
  };
});

vi.mock("next/navigation", () => ({
  useSearchParams: () =>
    new URLSearchParams("session_id=cs_test_return&status=completed"),
}));

const tiers = [
  {
    tier_id: "support_small" as const,
    label: "Small support",
    display_amount: "5.00",
    currency: "SAR",
  },
  {
    tier_id: "support_medium" as const,
    label: "Medium support",
    display_amount: "15.00",
    currency: "SAR",
  },
  {
    tier_id: "support_large" as const,
    label: "Large support",
    display_amount: "50.00",
    currency: "SAR",
  },
];

function renderLocalized(
  child: React.ReactNode,
  locale: "en" | "ar" = "en",
) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "ar" ? arMessages : enMessages}
    >
      {child}
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  getWebSupportPurchaseMock.mockReset();
});

describe("support-purchase UI", () => {
  it("uses optional product-support framing in English and Arabic", () => {
    const english = renderLocalized(<SupportPurchaseCard />);
    expect(screen.getByRole("heading", { name: "Support the product" })).toBeVisible();
    expect(screen.getByRole("link", { name: "View support options" })).toHaveAttribute(
      "href",
      "/en/settings/support",
    );
    expect(english.container.textContent?.toLowerCase()).not.toMatch(
      /\b(?:donate|donation|subscription|premium)\b/,
    );
    english.unmount();

    renderLocalized(<SupportPurchaseCard />, "ar");
    expect(screen.getByRole("heading", { name: "ادعم المنتج" })).toBeVisible();
    expect(screen.getByRole("link", { name: "عرض خيارات الدعم" })).toHaveAttribute(
      "href",
      "/ar/settings/support",
    );
  });

  it("renders only preset tier buttons and no payment-card inputs", () => {
    const { container } = renderLocalized(
      <SupportTierSelector locale="en" tiers={tiers} />,
    );

    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(2);
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent(
      "5.00 SAR",
    );
    expect(container.querySelector("input")).toBeNull();
    expect(screen.queryByLabelText(/custom amount/i)).not.toBeInTheDocument();
  });

  it("ignores a completed query parameter and renders polled backend pending state", async () => {
    getWebSupportPurchaseMock.mockResolvedValue({
      id: "purchase-1",
      tier_id: "support_small",
      channel: "web",
      amount_minor_units: 500,
      currency: "SAR",
      status: "pending",
      failure_reason: null,
      created_at: "2026-07-26T10:00:00Z",
      updated_at: "2026-07-26T10:00:00Z",
      provider_reference: "cs_test_return",
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderLocalized(
      <QueryClientProvider client={queryClient}>
        <SupportPurchaseResult />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Waiting for payment confirmation",
      }),
    ).toBeVisible();
    expect(screen.queryByText("Product support confirmed")).not.toBeInTheDocument();
    expect(getWebSupportPurchaseMock).toHaveBeenCalledWith("cs_test_return");
    queryClient.clear();
  });

  it("shows a specific refunded state and receipt, never a generic error", async () => {
    getWebSupportPurchaseMock.mockResolvedValue({
      id: "purchase-1",
      tier_id: "support_small",
      channel: "web",
      amount_minor_units: 500,
      currency: "SAR",
      status: "refunded",
      failure_reason: null,
      created_at: "2026-07-26T10:00:00Z",
      updated_at: "2026-08-01T10:00:00Z",
      provider_reference: "cs_test_return",
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderLocalized(
      <QueryClientProvider client={queryClient}>
        <SupportPurchaseResult />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Support purchase refunded" }),
    ).toBeVisible();
    expect(screen.queryByText("Purchase status unavailable")).not.toBeInTheDocument();
    expect(screen.getByTestId("support-purchase-receipt")).toBeInTheDocument();
    queryClient.clear();
  });
});

describe("payment-card field audit", () => {
  it("contains no card-number, security-code, or expiry input surface", () => {
    const files = [
      "components/settings/SupportPurchaseCard.tsx",
      "components/settings/SupportTierSelector.tsx",
      "components/settings/SupportPurchaseResult.tsx",
      "app/[locale]/(app)/settings/support/page.tsx",
      "app/[locale]/(app)/settings/support/result/page.tsx",
    ];
    const source = files
      .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/autocomplete\s*=\s*["']cc-/i);
    expect(source).not.toMatch(
      /name\s*=\s*["'](?:card[_-]?number|cvc|cvv|security[_-]?code|expir(?:y|ation))["']/i,
    );
    expect(source).not.toMatch(
      /label\s*=\s*["'](?:card number|cvc|cvv|security code|expiry date)["']/i,
    );
  });
});
