import { expect, test } from "@playwright/test";

import { createSeededUser, hasE2eEnvironment, seedIncome, seedWorkspace, signIn } from "./_helpers/matrix";
import arMessages from "../messages/ar.json";
import enMessages from "../messages/en.json";

/**
 * BUG-17: all nine signed-in routes returned the identical tab title
 * `Smart Expense - AI`.
 *
 * BUG-18: the workspace name was the `<h1>` of every page, so six routes had
 * two `<h1>` elements and three had none that named the page.
 */
const ROUTES = [
  "dashboard",
  "incomes",
  "expenses",
  "reports",
  "history",
  "categories",
  "files",
  "extractions",
  "settings",
] as const;

const messages: Record<"ar" | "en", { nav: Record<string, string> }> = {
  ar: arMessages,
  en: enMessages,
};
const SUFFIX = " · Smart Expense - AI";

test.describe("page titles and heading structure", () => {
  test.setTimeout(180_000);
  test.skip(!hasE2eEnvironment, "Set local Supabase credentials to run title checks.");

  for (const locale of ["en", "ar"] as const) {
    test(`gives every ${locale} route its own title and exactly one page heading`, async ({ page }) => {
      const user = await createSeededUser();
      const workspace = await seedWorkspace(user, `Titles ${locale}`);
      await seedIncome(user, workspace.id);
      await signIn(page, locale, user);

      const nav = messages[locale].nav;
      const seen = new Set<string>();

      for (const route of ROUTES) {
        await page.goto(`/${locale}/w/${workspace.id}/${route}`);
        await expect(
          page.getByLabel(locale === "ar" ? "تبديل مساحة العمل" : "Switch workspace"),
        ).toBeEnabled();

        // BUG-17 — the tab names the page, in the user's language.
        await expect(page).toHaveTitle(`${nav[route]}${SUFFIX}`);
        expect(seen.has(nav[route]), `${route} reuses another route's title`).toBe(false);
        seen.add(nav[route]);

        // BUG-18 — exactly one <h1>, and it is not the workspace name.
        const headings = page.locator("h1");
        await expect(headings, `${locale}/${route} should have one h1`).toHaveCount(1);
        const headingText = (await headings.first().textContent())?.trim() ?? "";
        expect(headingText.length, `${locale}/${route} h1 is empty`).toBeGreaterThan(0);
        expect(headingText, `${locale}/${route} h1 is still the workspace name`).not.toBe(
          `Titles ${locale}`,
        );
      }
    });
  }

  test("names the auth pages in the tab as well", async ({ page }) => {
    const auth = enMessages.auth;

    await page.goto("/en/sign-in");
    await expect(page).toHaveTitle(`${auth.signInTitle}${SUFFIX}`);

    await page.goto("/en/sign-up");
    await expect(page).toHaveTitle(`${auth.signUpTitle}${SUFFIX}`);
  });

  // The offline fallback is the one route whose title comes from a nested
  // namespace (`pwa.offline`), so it exercises a resolution path none of the
  // routes above do — and it needs no session to reach.
  test("names the offline fallback from its nested namespace", async ({ page }) => {
    await page.goto("/en/offline");
    await expect(page).toHaveTitle(`${enMessages.pwa.offline.title}${SUFFIX}`);

    await page.goto("/ar/offline");
    await expect(page).toHaveTitle(`${arMessages.pwa.offline.title}${SUFFIX}`);
  });
});
