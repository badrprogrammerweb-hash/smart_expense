import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { addWorkspaceMember, createSeededUser, hasE2eEnvironment, seedIncome, seedWorkspace, signIn } from "./_helpers/matrix";

const labels = {
  ar: { navigation: "التنقل", openNavigation: "فتح التنقل" },
  en: { navigation: "Navigation", openNavigation: "Open navigation" },
} as const;

async function expectWcagAa(page: Page, screen: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(blocking, `${screen}: ${blocking.map((violation) => violation.id).join(", ")}`).toEqual([]);
}

test.describe("design refresh accessibility", () => {
  test.setTimeout(180_000);
  test.skip(!hasE2eEnvironment, "Set local Supabase credentials to run accessibility checks.");

  for (const locale of ["ar", "en"] as const) {
    test(`meets WCAG AA on representative ${locale} screens and states`, async ({ page }) => {
      const owner = await createSeededUser();
      const viewer = await createSeededUser();
      const workspace = await seedWorkspace(owner, `Accessibility ${locale}`);
      const emptyWorkspace = await seedWorkspace(owner, `Accessibility empty ${locale}`);
      await seedIncome(owner, workspace.id);
      await addWorkspaceMember(owner, workspace.id, viewer.email, "viewer");
      await signIn(page, locale, owner);

      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(`/${locale}/w/${workspace.id}/dashboard`);
      await expectWcagAa(page, `${locale} dashboard`);
      const focusable = page.getByRole("button").first();
      await focusable.focus();
      await expect(focusable).toBeFocused();
      expect(await focusable.evaluate((element) => {
        const styles = getComputedStyle(element);
        return styles.outlineWidth !== "0px" || styles.boxShadow !== "none";
      })).toBe(true);

      await page.goto(`/${locale}/w/${workspace.id}/incomes`);
      await expectWcagAa(page, `${locale} record list and form`);

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/${locale}/w/${workspace.id}/incomes`);
      await expect(page.getByTestId("mobile-record-card")).toBeVisible();
      await expectWcagAa(page, `${locale} mobile record card`);

      await page.goto(`/${locale}/w/${workspace.id}/dashboard`);
      await page.getByRole("button", { name: labels[locale].openNavigation }).click();
      const dialog = page.getByRole("dialog", { name: labels[locale].navigation });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute("aria-modal", "true");
      await expectWcagAa(page, `${locale} navigation dialog`);

      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(`/${locale}/w/${workspace.id}/reports`);
      await expectWcagAa(page, `${locale} reports`);

      await page.goto(`/${locale}/w/${emptyWorkspace.id}/dashboard`);
      await expectWcagAa(page, `${locale} empty state`);

      await page.route(`**/workspaces/${workspace.id}/incomes`, async (route) => {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "request_failed", message: "Request failed" } }) });
      });
      await page.goto(`/${locale}/w/${workspace.id}/incomes`);
      await expect(page.getByRole("alert")).toBeVisible();
      await expectWcagAa(page, `${locale} error state`);
      await page.unroute(`**/workspaces/${workspace.id}/incomes`);

      await signIn(page, locale, viewer);
      await page.goto(`/${locale}/w/${workspace.id}/expenses`);
      await expect(page.getByTestId("permission-denied-state")).toBeVisible();
      await expectWcagAa(page, `${locale} permission state`);
    });
  }
});
