import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("error states", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run error-state checks.");

  test("expenses exceeding income show a clearly negative balance on dashboard and reports", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/en\/w\/.+\/dashboard$/);

    // A fresh workspace so this workspace's balance is driven only by the
    // records this test adds, not whatever other tests left behind.
    await page.getByRole("link", { name: "Create a team workspace" }).click();
    await page.waitForURL(/\/new-workspace$/);
    const workspaceName = `Negative Balance ${Date.now()}`;
    await page.getByLabel("Workspace name").fill(workspaceName);
    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();

    await page.getByRole("link", { name: "Incomes" }).click();
    await page.waitForURL(/\/incomes$/);
    await page.getByLabel("Amount").fill("100.00");
    await page.getByLabel("Date").fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Description").fill("Small income");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("SAR 100.00").first()).toBeVisible();

    await page.getByRole("link", { name: "Expenses" }).click();
    await page.waitForURL(/\/expenses$/);
    await page.getByLabel("Amount").fill("500.00");
    await page.getByLabel("Date").fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Description").fill("Big expense");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Big expense")).toBeVisible();

    // Remaining balance is not clamped to zero and not hidden (spec Edge Cases).
    await page.getByRole("link", { name: "Dashboard" }).click();
    await page.waitForURL(/\/dashboard$/);
    await expect(page.getByText("-SAR 400.00").first()).toBeVisible();

    await page.getByRole("link", { name: "Reports" }).click();
    await page.waitForURL(/\/reports$/);
    await expect(page.getByText("-SAR 400.00").first()).toBeVisible();
  });

  test("a failed dashboard request shows a retry control that recovers once the request succeeds again", async ({
    page,
  }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/en\/w\/.+\/dashboard$/);
    await expect(page.getByText("Total income")).toBeVisible();

    // Simulate the backend being unreachable (FR-036) at the network layer,
    // rather than actually stopping the FastAPI process, so this test does
    // not depend on controlling processes outside the browser.
    await page.route("**/workspaces/*/dashboard*", (route) => route.abort("connectionrefused"));
    await page.reload();

    const retryButton = page.getByRole("button", { name: "Retry" });
    await expect(retryButton).toBeVisible();
    await expect(page.getByText("Total income")).toHaveCount(0);

    // Backend is back — remove the interception and use the retry control.
    await page.unroute("**/workspaces/*/dashboard*");
    await retryButton.click();
    await expect(page.getByText("Total income")).toBeVisible();
  });
});
