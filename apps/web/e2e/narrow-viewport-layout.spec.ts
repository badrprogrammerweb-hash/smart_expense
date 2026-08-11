import { expect, test } from "@playwright/test";

import { createSeededUser, hasE2eEnvironment, seedIncome, seedWorkspace, signIn } from "./_helpers/matrix";

/**
 * BUG-05 measured `document.scrollWidth = 326` against `clientWidth = 320` on
 * all nine signed-in routes in both locales — the workspace header row could
 * not shrink, so the Sign out button's edge sat past the viewport.
 *
 * BUG-04 pinned the sticky submit bar 6rem above the viewport bottom to clear a
 * bottom nav that is only ~2.8rem tall, leaving a band in which form fields
 * rendered *below* the primary action.
 */
const NARROW = { width: 320, height: 700 };

const ROUTES = ["dashboard", "incomes", "expenses", "categories", "reports", "history", "settings"] as const;

test.describe("narrow viewport layout", () => {
  test.setTimeout(180_000);
  test.skip(!hasE2eEnvironment, "Set local Supabase credentials to run narrow-viewport checks.");

  for (const locale of ["en", "ar"] as const) {
    test(`does not overflow horizontally at 320px in ${locale}`, async ({ page }) => {
      const user = await createSeededUser();
      // A long name is the worst case: it previously pushed the header to 348.
      const workspace = await seedWorkspace(user, `Narrow ${locale} workspace with a long name`);
      await seedIncome(user, workspace.id);
      await signIn(page, locale, user);

      await page.setViewportSize(NARROW);

      for (const route of ROUTES) {
        await page.goto(`/${locale}/w/${workspace.id}/${route}`);
        await expect(page.getByLabel(locale === "ar" ? "تبديل مساحة العمل" : "Switch workspace")).toBeEnabled();

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));

        expect(scrollWidth, `${locale}/${route} overflows horizontally`).toBeLessThanOrEqual(clientWidth);
      }
    });
  }

  for (const [width, height] of [
    [320, 700],
    [360, 740],
    [375, 667],
    [390, 844],
  ] as const) {
    test(`keeps every income field reachable past the sticky bar at ${width}x${height}`, async ({ page }) => {
      const user = await createSeededUser();
      const workspace = await seedWorkspace(user, "Sticky bar");
      await signIn(page, "en", user);

      await page.setViewportSize({ width, height });
      await page.goto(`/en/w/${workspace.id}/incomes`);
      await expect(page.getByLabel("Switch workspace")).toBeEnabled();

      // The submit bar must sit flush on the nav. Any gap is a band where form
      // fields render below the primary action, which is what made users submit
      // before ever seeing Subcategory or Description.
      const gap = await page.evaluate(() => {
        const footer = document.querySelector("form .sticky");
        const nav = document.querySelector("nav.fixed");
        if (!footer || !nav) return null;
        return Math.round(nav.getBoundingClientRect().top - footer.getBoundingClientRect().bottom);
      });
      expect(gap, "sticky submit bar should rest directly on the bottom nav").toBe(0);

      // Scrolled to the end, nothing may remain trapped underneath the bar.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const trapped = await page.evaluate(() =>
        [...document.querySelectorAll("form select, form textarea, form input")]
          .filter((c) => c.getBoundingClientRect().width > 0)
          .filter((c) => {
            const r = c.getBoundingClientRect();
            const cy = r.top + r.height / 2;
            if (cy < 0 || cy > window.innerHeight) return false;
            const hit = document.elementFromPoint(r.left + r.width / 2, cy);
            return !!(hit && hit !== c && !c.contains(hit));
          })
          .map((c) => c.id),
      );
      expect(trapped, "fields must not stay covered at the end of the scroll").toEqual([]);
    });
  }
});
