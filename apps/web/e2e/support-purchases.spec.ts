import { expect, test, type Page } from "@playwright/test";

import {
  createSeededUser,
  hasE2eEnvironment,
  signIn,
} from "./_helpers/matrix";


const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

const tiers = {
  tiers: [
    {
      tier_id: "support_small",
      label: "Small support",
      display_amount: "5.00",
      currency: "SAR",
    },
    {
      tier_id: "support_medium",
      label: "Medium support",
      display_amount: "15.00",
      currency: "SAR",
    },
    {
      tier_id: "support_large",
      label: "Large support",
      display_amount: "50.00",
      currency: "SAR",
    },
  ],
};

async function mockSupportApi(
  page: Page,
  checkoutSessionId: string,
  statusForRequest: (
    requestNumber: number,
  ) => "pending" | "completed" | "failed" | "refunded",
  history: Array<Record<string, unknown>> = [],
) {
  let statusRequests = 0;

  await page.route(`${apiUrl}/support-purchases/tiers`, async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    await route.fulfill({ status: 200, contentType: "application/json", json: tiers });
  });
  await page.route(`${apiUrl}/support-purchases`, async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      json: { purchases: history },
    });
  });
  await page.route(
    `${apiUrl}/support-purchases/checkout-sessions`,
    async (route) => {
      expect(route.request().headers().authorization).toMatch(/^Bearer /);
      expect(route.request().postDataJSON()).toEqual({
        tier_id: "support_medium",
        locale: "en",
      });
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        json: {
          purchase_id: "00000000-0000-4000-8000-000000000001",
          checkout_url: `https://checkout.stripe.com/c/pay/${checkoutSessionId}`,
        },
      });
    },
  );
  await page.route(
    `${apiUrl}/support-purchases/session/${checkoutSessionId}`,
    async (route) => {
      statusRequests += 1;
      const status = statusForRequest(statusRequests);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          id: "00000000-0000-4000-8000-000000000001",
          tier_id: "support_medium",
          channel: "web",
          amount_minor_units: 1500,
          currency: "SAR",
          status,
          failure_reason: null,
          created_at: "2026-07-26T10:00:00Z",
          updated_at: "2026-07-26T10:00:00Z",
          provider_reference: checkoutSessionId,
        },
      });
    },
  );
}

async function mockStripeHostedPage(page: Page, checkoutSessionId: string) {
  await page.route("https://checkout.stripe.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html>
        <html lang="en">
          <body>
            <h1>Mock Stripe-hosted checkout</h1>
            <p>No external payment is performed by this automated test.</p>
            <a href="http://localhost:3000/en/settings/support/result?session_id=${checkoutSessionId}">
              Complete test checkout
            </a>
            <a href="http://localhost:3000/en/settings/support/result?session_id=${checkoutSessionId}">
              Cancel test checkout
            </a>
          </body>
        </html>`,
    });
  });
}

test.describe("web support purchase", () => {
  test("signed-out visitors are redirected to sign in", async ({ page }) => {
    await page.goto("/en/settings/support");
    await expect(page).toHaveURL(/\/en\/sign-in$/);
  });

  test("hosted checkout return stays pending until backend polling reports completion", async ({
    page,
  }) => {
    test.skip(
      !hasE2eEnvironment,
      "Set Supabase web environment variables to run authenticated support-purchase e2e.",
    );
    const user = await createSeededUser();
    const checkoutSessionId = "cs_test_e2e_completed";
    await mockSupportApi(
      page,
      checkoutSessionId,
      (requestNumber) => (requestNumber === 1 ? "pending" : "completed"),
    );
    await mockStripeHostedPage(page, checkoutSessionId);
    await signIn(page, "en", user);

    await page.goto("/en/settings/support");
    await expect(
      page.getByRole("heading", { name: "Support the product", exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Medium support.*15\.00 SAR/ })
      .click();
    await page.getByRole("button", { name: "Continue to Stripe" }).click();

    await expect(page).toHaveURL(/checkout\.stripe\.com/);
    await expect(
      page.getByRole("heading", { name: "Mock Stripe-hosted checkout" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Complete test checkout" }).click();

    await expect(
      page.getByRole("heading", { name: "Waiting for payment confirmation" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Product support confirmed" }),
    ).toBeVisible({ timeout: 10_000 });
    const receipt = page.getByTestId("support-purchase-receipt");
    await expect(receipt).toContainText("15.00");
    await expect(receipt).toContainText("SAR");
    await expect(receipt).toContainText(checkoutSessionId);
  });

  test("cancelled hosted checkout returns to a retryable non-success state", async ({
    page,
  }) => {
    test.skip(
      !hasE2eEnvironment,
      "Set Supabase web environment variables to run authenticated support-purchase e2e.",
    );
    const user = await createSeededUser();
    const checkoutSessionId = "cs_test_e2e_cancelled";
    await mockSupportApi(page, checkoutSessionId, () => "pending");
    await mockStripeHostedPage(page, checkoutSessionId);
    await signIn(page, "en", user);

    await page.goto("/en/settings/support");
    await page
      .getByRole("button", { name: /Medium support.*15\.00 SAR/ })
      .click();
    await page.getByRole("button", { name: "Continue to Stripe" }).click();
    await expect(page).toHaveURL(/checkout\.stripe\.com/);
    await page.getByRole("link", { name: "Cancel test checkout" }).click();

    await expect(
      page.getByRole("heading", { name: "Waiting for payment confirmation" }),
    ).toBeVisible();
    await expect(page.getByText("Product support confirmed")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Choose a support tier" }),
    ).toHaveAttribute("href", "/en/settings/support");
  });

  test("history renders pending, completed, failed, and refunded distinctly", async ({
    page,
  }) => {
    test.skip(
      !hasE2eEnvironment,
      "Set Supabase web environment variables to run authenticated support-purchase e2e.",
    );
    const user = await createSeededUser();
    const states = ["pending", "completed", "failed", "refunded"] as const;
    const history = states.map((status, index) => ({
      id: `00000000-0000-4000-8000-00000000000${index + 1}`,
      tier_id: "support_small",
      channel: index === 2 ? "ios" : "web",
      amount_minor_units: 500,
      currency: "SAR",
      status,
      failure_reason: status === "failed" ? "checkout_expired" : null,
      created_at: `2026-07-2${index + 1}T10:00:00Z`,
      updated_at: `2026-07-2${index + 1}T10:00:00Z`,
      provider_reference: `provider-reference-${index}`,
    }));
    await mockSupportApi(
      page,
      "cs_test_history_unused",
      () => "pending",
      history,
    );
    await signIn(page, "en", user);

    await page.goto("/en/settings/support");

    await expect(page.getByTestId("support-history-item")).toHaveCount(4);
    await expect(page.locator('[data-status="pending"]')).toContainText("Pending");
    await expect(page.locator('[data-status="completed"]')).toContainText("Completed");
    await expect(page.locator('[data-status="failed"]')).toContainText("Failed");
    await expect(page.locator('[data-status="refunded"]')).toContainText("Refunded");
    await expect(page.getByText("Product support confirmed")).toHaveCount(0);
    await expect(page.getByText("checkout_expired")).toHaveCount(0);
  });
});
