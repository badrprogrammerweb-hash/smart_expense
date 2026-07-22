import { expect, test } from "@playwright/test";

import { addWorkspaceMember, createSeededUser, hasE2eEnvironment, seedIncome, seedWorkspace, signIn } from "./_helpers/matrix";

const labels = {
  ar: { navigation: "التنقل", openNavigation: "فتح التنقل" },
  en: { navigation: "Navigation", openNavigation: "Open navigation" },
} as const;

async function capture(page: import("@playwright/test").Page, name: string) {
  await expect(page).toHaveScreenshot(`${name}.png`, { animations: "disabled" });
}

async function captureMobileRecordCard(page: import("@playwright/test").Page, name: string) {
  await expect(page.getByTestId("mobile-record-card")).toHaveScreenshot(`${name}.png`, { animations: "disabled" });
}

test.describe("design refresh visual regression", () => {
  test.setTimeout(180_000);
  test.skip(!hasE2eEnvironment, "Set local Supabase credentials to run visual regression checks.");

  for (const locale of ["ar", "en"] as const) {
    test(`captures representative ${locale} screens and states`, async ({ page }) => {
      const owner = await createSeededUser();
      const viewer = await createSeededUser();
      const workspace = await seedWorkspace(owner, `Visual ${locale}`);
      const emptyWorkspace = await seedWorkspace(owner, `Visual empty ${locale}`);
      await seedIncome(owner, workspace.id);
      await addWorkspaceMember(owner, workspace.id, viewer.email, "viewer");
      await signIn(page, locale, owner);

      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(`/${locale}/w/${workspace.id}/dashboard`);
      await capture(page, `${locale}-dashboard`);

      await page.goto(`/${locale}/w/${workspace.id}/incomes`);
      await capture(page, `${locale}-record-list-and-form`);

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/${locale}/w/${workspace.id}/incomes`);
      await expect(page.getByTestId("mobile-record-card")).toBeVisible();
      await captureMobileRecordCard(page, `${locale}-record-mobile-card`);

      await page.goto(`/${locale}/w/${workspace.id}/dashboard`);
      await page.getByRole("button", { name: labels[locale].openNavigation }).click();
      await expect(page.getByRole("dialog", { name: labels[locale].navigation })).toBeVisible();
      await capture(page, `${locale}-mobile-navigation-dialog`);

      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(`/${locale}/w/${workspace.id}/reports`);
      await capture(page, `${locale}-reports`);

      await page.goto(`/${locale}/w/${emptyWorkspace.id}/dashboard`);
      await capture(page, `${locale}-empty-state`);

      await page.route(`**/workspaces/${workspace.id}/incomes`, async (route) => {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "request_failed", message: "Request failed" } }) });
      });
      await page.goto(`/${locale}/w/${workspace.id}/incomes`);
      await expect(page.getByRole("alert")).toBeVisible();
      await capture(page, `${locale}-error-state`);
      await page.unroute(`**/workspaces/${workspace.id}/incomes`);

      await signIn(page, locale, viewer);
      await page.goto(`/${locale}/w/${workspace.id}/expenses`);
      await expect(page.getByTestId("permission-denied-state")).toBeVisible();
      await capture(page, `${locale}-permission-state`);
    });
  }
});
