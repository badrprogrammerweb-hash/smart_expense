import { expect, test, type Locator, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

// Every record is rendered twice: once in the desktop list
// (`<ul className="hidden … md:block">`) and once as a mobile card
// (`<div className="… md:hidden">` wrapping `MobileRecordCard`, which carries
// `data-testid="mobile-record-card"`). Both stay in the DOM at every viewport
// — only CSS decides which one is displayed — so an unscoped `getByText`
// always resolves to two elements and trips strict mode.
//
// `:visible` selects by rendered box rather than by guessing which branch the
// viewport took, so this resolves to whichever representation is genuinely
// displayed (the desktop row under the `chromium` project, the mobile card
// under the `mobile-*` projects) and never to the hidden twin. That keeps the
// "exactly one logical record" assertions meaningful: one record still yields
// exactly one match.
function recordRow(page: Page, text: string): Locator {
  return page
    .locator("li:visible, [data-testid='mobile-record-card']:visible")
    .filter({ hasText: text });
}

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
    await page.getByLabel("Date", { exact: true }).fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Description").fill("Salary");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("SAR 5,000.00").first()).toBeVisible();

    await page.getByRole("link", { name: "Expenses" }).click();
    await page.waitForURL(/\/expenses$/);
    await page.getByLabel("Amount").fill("450.50");
    await page.getByLabel("Date", { exact: true }).fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Description").fill("Lunch");
    await page.getByRole("button", { name: "Save" }).click();
    const lunchRow = recordRow(page, "Lunch");
    await expect(lunchRow).toBeVisible();
    await expect(lunchRow).toHaveCount(1);

    await lunchRow.getByRole("button", { name: "Edit" }).click();
    // The always-visible "create" form above the list also has an "Amount"
    // field, and both forms label it via the same `id="expense-amount"`
    // (ExpenseForm.tsx) — so `getByLabel("Amount")` resolves through the
    // label's `for` to the *create* form's input, which sits outside this row.
    // Address the editing row's own control by form field name instead.
    const editingRow = page
      .locator("li:visible, [data-testid='mobile-record-card']:visible")
      .filter({ has: page.locator('input[name="amount"]') });
    await editingRow.locator('input[name="amount"]').fill("500.00");
    await editingRow.getByRole("button", { name: "Save" }).click();
    await expect(recordRow(page, "Lunch").getByText("SAR 500.00")).toBeVisible();

    const rowToDelete = recordRow(page, "Lunch");
    await rowToDelete.getByRole("button", { name: "Delete" }).click();
    await rowToDelete.getByRole("button", { name: "Confirm delete" }).click();
    await expect(recordRow(page, "Lunch")).toHaveCount(0);
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
    await page.getByLabel("Date", { exact: true }).fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Description").fill(description);

    const createRequests: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && /\/workspaces\/[^/]+\/incomes$/.test(new URL(request.url()).pathname)) {
        createRequests.push(request.url());
      }
    });

    // A real double-click sends both click events before React's re-render
    // can disable the button — the case the form's isSubmitting/isPending
    // disabled guard (IncomeForm.tsx) is meant to cover. The deterministic
    // unit test in tests/unit/double-submit-protection.test.tsx proves the
    // same guard at the component level (two clicks in the same tick, no
    // gap for React to flush); this asserts it end-to-end by counting the
    // actual create requests sent, not just the rendered list — a duplicate
    // request that the UI happened to collapse into one visible row would
    // otherwise go unnoticed.
    await page.getByRole("button", { name: "Save" }).dblclick();

    // Scoped to the displayed representation so the hidden mobile/desktop twin
    // does not inflate the count — this must still fail if a genuine duplicate
    // record is created.
    await expect(recordRow(page, description)).toBeVisible();
    await expect(recordRow(page, description)).toHaveCount(1);
    expect(createRequests).toHaveLength(1);
  });
});
