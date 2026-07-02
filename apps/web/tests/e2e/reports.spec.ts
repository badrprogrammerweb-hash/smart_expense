import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("reports", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run reports checks.");

  test("reports figures match the dashboard's, and show a clear empty state with no records", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/en\/w\/.+\/dashboard$/);
    await expect(page.getByText("Total income")).toBeVisible();

    // The shared E2E account may already have records from other tests in
    // the same run, so the empty-state check needs its own guaranteed-fresh
    // workspace rather than assuming the signed-in one is pristine.
    await page.getByRole("link", { name: "Create a team workspace" }).click();
    await page.waitForURL(/\/new-workspace$/);
    const workspaceName = `Figures Check ${Date.now()}`;
    await page.getByLabel("Workspace name").fill(workspaceName);
    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();

    await page.getByRole("link", { name: "Reports" }).click();
    await page.waitForURL(/\/reports$/);
    await expect(page.getByRole("heading", { name: "No confirmed records this period" })).toBeVisible();

    // Add income and a categorized expense.
    await page.getByRole("link", { name: "Incomes" }).click();
    await page.waitForURL(/\/incomes$/);
    await page.getByLabel("Amount").fill("2000.00");
    await page.getByLabel("Date").fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Description").fill("Salary");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("SAR 2,000.00").first()).toBeVisible();

    await page.getByRole("link", { name: "Expenses" }).click();
    await page.waitForURL(/\/expenses$/);
    await page.getByLabel("Amount").fill("300.00");
    await page.getByLabel("Date").fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Description").fill("Groceries run");
    await page.getByLabel("Category").selectOption({ label: "Groceries" });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Groceries run")).toBeVisible();

    // Dashboard figures.
    await page.getByRole("link", { name: "Dashboard" }).click();
    await page.waitForURL(/\/dashboard$/);
    await expect(page.getByText("SAR 2,000.00").first()).toBeVisible();
    await expect(page.getByText("SAR 300.00").first()).toBeVisible();
    await expect(page.getByText("SAR 1,700.00").first()).toBeVisible();
    await expect(page.getByText("Groceries", { exact: true })).toBeVisible();

    // Reports must show the exact same figures, sourced from the same
    // dashboard endpoint (FR-028) — no separate report calculation exists
    // to drift from it.
    await page.getByRole("link", { name: "Reports" }).click();
    await page.waitForURL(/\/reports$/);
    await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
    await expect(page.getByText("SAR 2,000.00").first()).toBeVisible();
    await expect(page.getByText("SAR 300.00").first()).toBeVisible();
    await expect(page.getByText("SAR 1,700.00").first()).toBeVisible();
    await expect(page.getByText("Groceries", { exact: true })).toBeVisible();
  });
});
