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
      // The income create form defaults its date field to `new Date()`
      // (IncomeForm.tsx), which renders visibly on the incomes page. Freeze
      // the browser clock so that value — and any other current-date read —
      // stays fixed across runs instead of drifting with the real calendar
      // day the suite happens to execute on.
      await page.clock.setFixedTime(new Date("2026-07-13T09:00:00.000Z"));

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
      // The income list loads asynchronously; without waiting for the
      // seeded record to appear, the screenshot can race the fetch and
      // capture the loading skeleton instead (a static skeleton frame
      // passes Playwright's own frame-to-frame stability check, so it
      // isn't caught by `toHaveScreenshot` alone).
      //await expect(page.getByText("RTL regression income")).toBeVisible();
      await expect(
        page
          .getByText("RTL regression income", { exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
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

      // A generic getByRole("alert") can match unrelated live regions
      // elsewhere on the page (e.g. dev-mode overlays), so wait on the
      // income list's own error state instead.
      await expect(page.getByTestId("income-error-state")).toBeVisible();

      await expect(
        page.locator('[data-slot="skeleton"]').filter({ visible: true }),
      ).toHaveCount(0);

      // Allow responsive RTL layout to finish settling before the screenshot.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );

      await capture(page, `${locale}-error-state`);
      await page.unroute(`**/workspaces/${workspace.id}/incomes`);

      await signIn(page, locale, viewer);
      await page.goto(`/${locale}/w/${workspace.id}/expenses`);
      await expect(page.getByTestId("permission-denied-state")).toBeVisible();
      await capture(page, `${locale}-permission-state`);
    });
  }
});
