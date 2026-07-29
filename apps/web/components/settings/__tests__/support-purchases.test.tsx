import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SupportPurchaseCard } from "@/components/settings/SupportPurchaseCard";
import { SupportReceiptView } from "@/components/settings/SupportReceiptView";
import { SupportPurchaseResult } from "@/components/settings/SupportPurchaseResult";
import { SupportTierSelector } from "@/components/settings/SupportTierSelector";
import type {
  NativeMobileVerifyRequest,
  NativeSupportTier,
  NativeVerifiedSupportPurchase,
} from "@/lib/platform/capacitor";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";
import { SupportPurchaseHistory } from "@/components/settings/SupportPurchaseHistory";
import { ApiError } from "@/lib/api/client";


const supportApiMocks = vi.hoisted(() => ({
  getSupportPurchaseReceipt: vi.fn(),
  getWebSupportPurchase: vi.fn(),
  listSupportPurchases: vi.fn(),
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
  supportApiMocks.getSupportPurchaseReceipt.mockReset();
  supportApiMocks.getWebSupportPurchase.mockReset();
  supportApiMocks.listSupportPurchases.mockReset();
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

  it("renders completed and failed result states without exposing stored internals", async () => {
    supportApiMocks.getWebSupportPurchase.mockResolvedValueOnce({
      id: "purchase-completed",
      tier_id: "support_small",
      channel: "web",
      amount_minor_units: 500,
      currency: "SAR",
      status: "completed",
      failure_reason: null,
      created_at: "2026-07-26T10:00:00Z",
      updated_at: "2026-07-26T10:00:00Z",
      provider_reference: "cs_test_return",
    });
    const completedClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const completed = renderLocalized(
      <QueryClientProvider client={completedClient}>
        <SupportPurchaseResult />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Product support confirmed" }),
    ).toBeVisible();
    completed.unmount();
    completedClient.clear();

    supportApiMocks.getWebSupportPurchase.mockResolvedValueOnce({
      id: "purchase-failed",
      tier_id: "support_small",
      channel: "web",
      amount_minor_units: 500,
      currency: "SAR",
      status: "failed",
      failure_reason: "checkout_expired",
      created_at: "2026-07-26T10:00:00Z",
      updated_at: "2026-07-27T10:00:00Z",
      provider_reference: "cs_test_return",
    });
    const failedClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    renderLocalized(
      <QueryClientProvider client={failedClient}>
        <SupportPurchaseResult />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Payment was not completed" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "The secure checkout expired before payment was confirmed. You can try again.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("checkout_expired")).not.toBeInTheDocument();
    expect(screen.queryByText("Product support confirmed")).not.toBeInTheDocument();
    failedClient.clear();
  });

  it("renders account history with all four states and RTL-safe references", async () => {
    supportApiMocks.listSupportPurchases.mockResolvedValue(
      (["pending", "completed", "failed", "refunded"] as const).map(
        (status, index) => ({
          id: `purchase-${status}`,
          tier_id: "support_small",
          channel: index === 2 ? ("ios" as const) : ("web" as const),
          amount_minor_units: 500,
          currency: "SAR",
          status,
          failure_reason: status === "failed" ? "store_cancelled" : null,
          created_at: `2026-07-2${index + 1}T10:00:00Z`,
          updated_at: `2026-07-2${index + 1}T10:00:00Z`,
          provider_reference: `provider-reference-${index}`,
        }),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { container } = renderLocalized(
      <QueryClientProvider client={queryClient}>
        <SupportPurchaseHistory />
      </QueryClientProvider>,
      "ar",
    );

    expect(await screen.findAllByTestId("support-history-item")).toHaveLength(4);
    for (const status of ["pending", "completed", "failed", "refunded"]) {
      expect(
        container.querySelector(`[data-status="${status}"]`),
      ).toBeInTheDocument();
    }
    expect(container.querySelectorAll('[dir="ltr"]').length).toBeGreaterThanOrEqual(4);
    expect(container.textContent).not.toContain("store_cancelled");
    expect(
      screen.getAllByRole("button", { name: "عرض الإيصال" }),
    ).toHaveLength(1);
    queryClient.clear();
  });

  it("renders an explicit empty history state", async () => {
    supportApiMocks.listSupportPurchases.mockResolvedValue([]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderLocalized(
      <QueryClientProvider client={queryClient}>
        <SupportPurchaseHistory />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "No product support purchases yet",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Nothing is expected or required. The complete product remains available to you.",
      ),
    ).toBeVisible();
    queryClient.clear();
  });

  it("renders only backend-eligible completed receipt actions and keeps API order", async () => {
    supportApiMocks.listSupportPurchases.mockResolvedValue([
      {
        id: "purchase-newest-refunded",
        tier_id: "support_large",
        channel: "android",
        amount_minor_units: 5000,
        currency: "SAR",
        status: "refunded",
        failure_reason: null,
        created_at: "2026-07-28T10:00:00Z",
        updated_at: "2026-07-28T10:00:00Z",
        provider_reference: null,
      },
      {
        id: "purchase-completed",
        tier_id: "support_medium",
        channel: "ios",
        amount_minor_units: 1500,
        currency: "SAR",
        status: "completed",
        failure_reason: null,
        created_at: "2026-07-27T10:00:00Z",
        updated_at: "2026-07-27T10:00:00Z",
        provider_reference: "2000001043762129",
      },
      {
        id: "purchase-oldest-pending",
        tier_id: "support_small",
        channel: "web",
        amount_minor_units: 500,
        currency: "SAR",
        status: "pending",
        failure_reason: null,
        created_at: "2026-07-26T10:00:00Z",
        updated_at: "2026-07-26T10:00:00Z",
        provider_reference: "cs_test_pending",
      },
    ]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderLocalized(
      <QueryClientProvider client={queryClient}>
        <SupportPurchaseHistory />
      </QueryClientProvider>,
    );

    const rows = await screen.findAllByTestId("support-history-item");
    expect(rows.map((row) => row.getAttribute("data-status"))).toEqual([
      "refunded",
      "completed",
      "pending",
    ]);
    expect(
      screen.getAllByRole("button", { name: "View receipt" }),
    ).toHaveLength(1);
    expect(rows[1]).toContainElement(
      screen.getByRole("button", { name: "View receipt" }),
    );
    queryClient.clear();
  });

  it("renders a safe completed receipt summary and an allow-listed provider link", async () => {
    supportApiMocks.getSupportPurchaseReceipt.mockResolvedValue({
      id: "purchase-receipt",
      tier_id: "support_medium",
      channel: "web",
      amount_minor_units: 1500,
      currency: "SAR",
      status: "completed",
      created_at: "2026-07-26T10:00:00Z",
      provider_reference: "cs_test_receipt",
      provider_receipt_url: "https://pay.stripe.com/receipts/test-receipt",
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { container } = renderLocalized(
      <QueryClientProvider client={queryClient}>
        <SupportReceiptView purchaseId="purchase-receipt" />
      </QueryClientProvider>,
      "ar",
    );

    expect(
      await screen.findByRole("heading", { name: "إيصال دعم المنتج" }),
    ).toBeVisible();
    expect(screen.getByText("دعم متوسط")).toBeVisible();
    expect(screen.getByText(/15\.00/)).toBeVisible();
    expect(screen.getByText("الويب")).toBeVisible();
    expect(screen.getByText("cs_test_receipt")).toHaveAttribute("dir", "ltr");
    const link = screen.getByRole("link", { name: "فتح إيصال المزوّد" });
    expect(link).toHaveAttribute(
      "href",
      "https://pay.stripe.com/receipts/test-receipt",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(container.textContent?.toLowerCase()).not.toMatch(
      /purchase[_-]?token|signed[_-]?payload|jws|stack trace/,
    );
    queryClient.clear();
  });

  it("does not render an untrusted receipt URL", async () => {
    supportApiMocks.getSupportPurchaseReceipt.mockResolvedValue({
      id: "purchase-receipt",
      tier_id: "support_medium",
      channel: "web",
      amount_minor_units: 1500,
      currency: "SAR",
      status: "completed",
      created_at: "2026-07-26T10:00:00Z",
      provider_reference: "cs_test_receipt",
      provider_receipt_url: "https://attacker.example/receipt",
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderLocalized(
      <QueryClientProvider client={queryClient}>
        <SupportReceiptView purchaseId="purchase-receipt" />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Product support receipt" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Open provider receipt" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("No verified provider receipt link is available."),
    ).toBeVisible();
    queryClient.clear();
  });

  it("renders receipt denied and unavailable states without provider details", async () => {
    supportApiMocks.getSupportPurchaseReceipt.mockRejectedValueOnce(
      new ApiError(404, "support_purchase_not_found", "not found"),
    );
    const deniedClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const denied = renderLocalized(
      <QueryClientProvider client={deniedClient}>
        <SupportReceiptView purchaseId="purchase-denied" />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Receipt is not available")).toBeVisible();
    expect(screen.queryByText("support_purchase_not_found")).not.toBeInTheDocument();
    denied.unmount();
    deniedClient.clear();

    supportApiMocks.getSupportPurchaseReceipt.mockRejectedValueOnce(
      new Error("provider stack trace secret"),
    );
    const unavailableClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    renderLocalized(
      <QueryClientProvider client={unavailableClient}>
        <SupportReceiptView purchaseId="purchase-unavailable" />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Receipt could not be loaded")).toBeVisible();
    expect(screen.queryByText(/provider stack trace secret/i)).not.toBeInTheDocument();
    unavailableClient.clear();
  });

  it("uses the native bridge for the same cross-channel history and receipt APIs", async () => {
    const history = [
      {
        id: "purchase-web",
        tier_id: "support_small",
        channel: "web" as const,
        amount_minor_units: 500,
        currency: "SAR",
        status: "pending" as const,
        failure_reason: null,
        created_at: "2026-07-28T10:00:00Z",
        updated_at: "2026-07-28T10:00:00Z",
        provider_reference: "cs_test_pending",
      },
      {
        id: "purchase-ios",
        tier_id: "support_medium",
        channel: "ios" as const,
        amount_minor_units: 1500,
        currency: "SAR",
        status: "completed" as const,
        failure_reason: null,
        created_at: "2026-07-27T10:00:00Z",
        updated_at: "2026-07-27T10:00:00Z",
        provider_reference: "2000001043762129",
      },
      {
        id: "purchase-android",
        tier_id: "support_large",
        channel: "android" as const,
        amount_minor_units: 5000,
        currency: "SAR",
        status: "refunded" as const,
        failure_reason: null,
        created_at: "2026-07-26T10:00:00Z",
        updated_at: "2026-07-26T10:00:00Z",
        provider_reference: null,
      },
    ];
    supportApiMocks.listSupportPurchases.mockResolvedValue(history);
    supportApiMocks.getSupportPurchaseReceipt.mockResolvedValue({
      id: "purchase-ios",
      tier_id: "support_medium",
      channel: "ios",
      amount_minor_units: 1500,
      currency: "SAR",
      status: "completed",
      created_at: "2026-07-27T10:00:00Z",
      provider_reference: "2000001043762129",
      provider_receipt_url: null,
    });
    const listHistory = vi.fn(async (fetchHistory) => fetchHistory());
    const getReceipt = vi.fn(async (purchaseId, fetchReceipt) =>
      fetchReceipt(purchaseId),
    );
    nativePlatformMocks.isNative.mockReturnValue(true);
    nativePlatformMocks.nativeSupportBilling.mockReturnValue({
      listTiers: vi.fn(),
      purchase: vi.fn(),
      listHistory,
      getReceipt,
      openReceipt: vi.fn(),
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderLocalized(
      <QueryClientProvider client={queryClient}>
        <SupportPurchaseHistory />
      </QueryClientProvider>,
    );

    expect(await screen.findAllByTestId("support-history-item")).toHaveLength(3);
    expect(screen.getByText("Web")).toBeVisible();
    expect(screen.getByText("Apple App Store")).toBeVisible();
    expect(screen.getByText("Google Play")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "View receipt" }));
    expect(
      await screen.findByRole("heading", { name: "Product support receipt" }),
    ).toBeVisible();
    expect(listHistory).toHaveBeenCalledWith(
      supportApiMocks.listSupportPurchases,
    );
    expect(getReceipt).toHaveBeenCalledWith(
      "purchase-ios",
      supportApiMocks.getSupportPurchaseReceipt,
    );
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
      "components/settings/SupportPurchaseHistory.tsx",
      "components/settings/SupportReceiptView.tsx",
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
    expect(source).not.toMatch(
      /(?:purchase[_-]?token|signed[_-]?payload|webhook[_-]?payload|raw[_-]?provider[_-]?error)/i,
    );
    const receiptSource = readFileSync(
      resolve(
        process.cwd(),
        "components/settings/SupportReceiptView.tsx",
      ),
      "utf8",
    );
    expect(receiptSource).toContain("isSafeProviderReceiptUrl");
    expect(receiptSource).toMatch(/rel=["']noopener noreferrer["']/);
  });
});
