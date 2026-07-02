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
    await page.waitForURL(/\/incomes$/);
    await page.getByLabel("Amount").fill("5000");
    await page.getByLabel("Date").fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Description").fill("Salary");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("SAR 5,000.00").first()).toBeVisible();

    await page.getByRole("link", { name: "Expenses" }).click();
    await page.waitForURL(/\/expenses$/);
    await page.getByLabel("Amount").fill("450.50");
    await page.getByLabel("Date").fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Description").fill("Lunch");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Lunch")).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).first().click();
    // The always-visible "create" form above the list also has an "Amount"
    // field, so once editing starts there are two on the page — scope to
    // the row currently in edit mode (the only <li> containing a textbox).
    const editingRow = page.locator("li").filter({ has: page.getByRole("textbox") });
    await editingRow.getByLabel("Amount").fill("500.00");
    await editingRow.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("SAR 500.00").first()).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).first().click();
    await page.getByRole("button", { name: "Confirm delete" }).first().click();
    await expect(page.getByText("Lunch")).toHaveCount(0);
  });

  test("double-submitting the income form does not create a duplicate record", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole("link", { name: "Add income" }).click();
    await page.waitForURL(/\/incomes$/);

    const description = `Double submit check ${Date.now()}`;
    await page.getByLabel("Amount").fill("42.00");
    await page.getByLabel("Date").fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Description").fill(description);
    // A real double-click sends both click events before React's re-render
    // can disable the button — the case the form's isSubmitting/isPending
    // disabled guard (IncomeForm.tsx) is meant to cover.
    await page.getByRole("button", { name: "Save" }).dblclick();

    await expect(page.getByText(description)).toBeVisible();
    await expect(page.getByText(description)).toHaveCount(1);
  });
});
