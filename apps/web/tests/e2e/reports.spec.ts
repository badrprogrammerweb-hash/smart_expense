import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("reports", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run reports checks.");

  test("reports figures match the dashboard, switch periods, and show empty states", async ({
    page,
  }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/en\/w\/.+\/dashboard$/);
    await expect(page.getByText("Total income")).toBeVisible();

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
    await expect(page.getByText("Spending trend")).toBeVisible();
    await expect(page.getByText("Top merchants")).toBeVisible();

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
    await page.getByLabel("Merchant").fill("Market");
    await page.getByLabel("Description").fill("Groceries run");
    await page.getByLabel("Category").selectOption({ label: "Groceries" });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Groceries run")).toBeVisible();

    await page.getByRole("link", { name: "Dashboard" }).click();
    await page.waitForURL(/\/dashboard$/);
    await expect(page.getByText("SAR 2,000.00").first()).toBeVisible();
    await expect(page.getByText("SAR 300.00").first()).toBeVisible();
    await expect(page.getByText("SAR 1,700.00").first()).toBeVisible();
    await expect(page.getByText("Groceries", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Reports" }).click();
    await page.waitForURL(/\/reports$/);
    await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
    await expect(page.getByText("Reporting period")).toBeVisible();
    await expect(page.getByText("SAR 2,000.00").first()).toBeVisible();
    await expect(page.getByText("SAR 300.00").first()).toBeVisible();
    await expect(page.getByText("SAR 1,700.00").first()).toBeVisible();
    await expect(page.getByText("Groceries", { exact: true })).toBeVisible();
    await expect(page.getByText("Spending trend")).toBeVisible();
    await expect(page.getByText("Top merchants")).toBeVisible();
    await expect(page.getByText("Market")).toBeVisible();
    await expect(page.getByText("Groceries run")).toBeVisible();

    await page.getByLabel("Start date").fill("2025-01-01");
    await page.getByLabel("End date").fill("2025-01-31");
    await page.getByRole("button", { name: "Apply custom range" }).click();
    await expect(page.getByRole("heading", { name: "No confirmed records this period" })).toBeVisible();
    await expect(page.getByText("No trend data for this period.")).toBeVisible();
    await expect(page.getByText("No merchant spending for this period.")).toBeVisible();

    await page.getByRole("button", { name: "Current month" }).click();
    await expect(page.getByText("SAR 2,000.00").first()).toBeVisible();
  });
});
