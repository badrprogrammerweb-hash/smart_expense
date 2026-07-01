import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("income and expense flow", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run income/expense flow.");

  test("income and expense records update dashboard totals and history", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole("link", { name: "Add income" }).click();
    await page.getByLabel("Amount").fill("5000");
    await page.getByLabel("Date").fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Description").fill("Salary");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("SAR 5,000.00").first()).toBeVisible();

    await page.getByRole("link", { name: "Expenses" }).click();
    await page.getByLabel("Amount").fill("450.50");
    await page.getByLabel("Date").fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Description").fill("Lunch");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Lunch")).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByLabel("Amount").fill("500.00");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("SAR 500.00").first()).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).first().click();
    await page.getByRole("button", { name: "Confirm delete" }).first().click();
    await expect(page.getByText("Lunch")).toHaveCount(0);
  });
});
