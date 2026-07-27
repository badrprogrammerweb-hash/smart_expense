import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SupportPurchaseCard } from "@/components/settings/SupportPurchaseCard";
import { SupportPurchaseResult } from "@/components/settings/SupportPurchaseResult";
import { SupportTierSelector } from "@/components/settings/SupportTierSelector";
import type {
  NativeMobileVerifyRequest,
  NativeSupportTier,
  NativeVerifiedSupportPurchase,
} from "@/lib/platform/capacitor";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";


const supportApiMocks = vi.hoisted(() => ({
  getWebSupportPurchase: vi.fn(),
  startSupportCheckout: vi.fn(),
  verifyMobileSupportPurchase: vi.fn(),
}));
const getMeMock = vi.hoisted(() => vi.fn());
const nativePlatformMocks = vi.hoisted(() => ({
  isNative: vi.fn(() => false),
  nativeSupportBilling: vi.fn(),
}));

vi.mock("@/lib/api/support-purchases", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/support-purchases")>();
  return {
    ...actual,
    ...supportApiMocks,
  };
});

vi.mock("@/lib/api/me", () => ({
  getMe: getMeMock,
}));

vi.mock("@/lib/platform/capacitor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/platform/capacitor")>();
  return {
    ...actual,
    ...nativePlatformMocks,
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
  supportApiMocks.getWebSupportPurchase.mockReset();
  supportApiMocks.startSupportCheckout.mockReset();
  supportApiMocks.verifyMobileSupportPurchase.mockReset();
  getMeMock.mockReset();
  nativePlatformMocks.isNative.mockReset();
  nativePlatformMocks.isNative.mockReturnValue(false);
  nativePlatformMocks.nativeSupportBilling.mockReset();
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
    supportApiMocks.getWebSupportPurchase.mockResolvedValue({
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
    expect(supportApiMocks.getWebSupportPurchase).toHaveBeenCalledWith("cs_test_return");
    queryClient.clear();
  });

  it("shows a specific refunded state and receipt, never a generic error", async () => {
    supportApiMocks.getWebSupportPurchase.mockResolvedValue({
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

  it("uses native store billing inside Capacitor and never starts Stripe checkout", async () => {
    const verifiedPurchase = {
      id: "purchase-native",
      tier_id: "support_small",
      channel: "android" as const,
      amount_minor_units: 599,
      currency: "SAR",
      status: "completed" as const,
      failure_reason: null,
      created_at: "2026-07-26T10:00:00Z",
      updated_at: "2026-07-26T10:00:01Z",
      provider_reference: null,
    };
    const purchase = vi.fn(
      async ({
        verify,
      }: {
        verify: (
          request: NativeMobileVerifyRequest,
        ) => Promise<NativeVerifiedSupportPurchase>;
      }) => ({
        status: "completed" as const,
        purchase: await verify({
          tier_id: "support_small",
          channel: "google",
          provider_transaction_id: "secret-google-token",
        }),
      }),
    );
    const listTiers = vi.fn(async (values: NativeSupportTier[]) =>
      values.map((tier, index) => ({
        ...tier,
        display_amount: ["SAR 5.99", "SAR 15.99", "SAR 49.99"][index],
      })),
    );
    nativePlatformMocks.isNative.mockReturnValue(true);
    nativePlatformMocks.nativeSupportBilling.mockReturnValue({
      listTiers,
      purchase,
    });
    getMeMock.mockResolvedValue({
      id: "b57eccea-2f0a-4143-92cd-e0b1524d237f",
    });
    supportApiMocks.verifyMobileSupportPurchase.mockResolvedValue(
      verifiedPurchase,
    );

    renderLocalized(<SupportTierSelector locale="en" tiers={tiers} />);

    expect(await screen.findByText("SAR 5.99")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to store purchase" }),
    );

    expect(await screen.findByText("Store product support confirmed.")).toBeVisible();
    expect(screen.getByTestId("native-support-receipt")).toHaveTextContent(
      "5.99 SAR",
    );
    expect(purchase).toHaveBeenCalledWith(
      expect.objectContaining({
        tier_id: "support_small",
        account_id: "b57eccea-2f0a-4143-92cd-e0b1524d237f",
      }),
    );
    expect(supportApiMocks.verifyMobileSupportPurchase).toHaveBeenCalledWith({
      tier_id: "support_small",
      channel: "google",
      provider_transaction_id: "secret-google-token",
    });
    await waitFor(() => {
      expect(supportApiMocks.startSupportCheckout).not.toHaveBeenCalled();
    });
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
