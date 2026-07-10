import { expect, test } from "@playwright/test";

import arMessages from "../messages/ar.json";
import enMessages from "../messages/en.json";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

type CoreRoute = {
  path: string;
  english: string;
  arabic: string;
};

const coreRoutes: CoreRoute[] = [
  { path: "dashboard", english: enMessages.dashboard.title, arabic: arMessages.dashboard.title },
  { path: "incomes", english: enMessages.records.addIncome, arabic: arMessages.records.addIncome },
  { path: "expenses", english: enMessages.records.addExpense, arabic: arMessages.records.addExpense },
  { path: "reports", english: enMessages.reports.title, arabic: arMessages.reports.title },
  { path: "history", english: enMessages.history.title, arabic: arMessages.history.title },
  { path: "settings", english: enMessages.settings.title, arabic: arMessages.settings.title },
  {
    path: "extractions",
    english: enMessages.extraction.queue.emptyState,
    arabic: arMessages.extraction.queue.emptyState,
  },
];

test.describe("acceptance localization and RTL", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run localization acceptance checks.");

  test("switches every core route between English LTR and Arabic RTL with SAR amounts", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel(enMessages.auth.email).fill(email!);
    await page.getByLabel(enMessages.auth.password).fill(password!);
    await page.getByRole("button", { name: enMessages.auth.signIn }).click();
    await page.waitForURL(/\/en\/w\/[^/]+\/dashboard$/);

    const workspaceId = new URL(page.url()).pathname.split("/")[3];
    expect(workspaceId).toBeTruthy();

    for (const route of coreRoutes) {
      await page.goto(`/en/w/${workspaceId}/${route.path}`);
      await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
      await expect(page.getByText(route.english, { exact: true }).first()).toBeVisible();
    }

    await page.goto(`/en/w/${workspaceId}/settings`);
    await page.getByRole("button", { name: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629" }).click();
    await page.waitForURL(new RegExp(`/ar/w/${workspaceId}/settings$`));

    for (const route of coreRoutes) {
      await page.goto(`/ar/w/${workspaceId}/${route.path}`);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.getByText(route.arabic, { exact: true }).first()).toBeVisible();
    }

    await page.goto(`/ar/w/${workspaceId}/dashboard`);
    await expect(page.getByText(/(?:SAR|\u0631\.\u0633\.)/).first()).toBeVisible();
  });
});
