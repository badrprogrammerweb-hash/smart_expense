import { expect, test } from "@playwright/test";

import {
  createSeededUser,
  currentPeriodDate,
  hasE2eEnvironment,
  seedIncome,
  seedWorkspace,
  signIn,
  toDisplayDate,
} from "./_helpers/matrix";

const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;

// The seeded record is asserted on the dashboard, whose period comes from the
// server (apps/api/app/services/dashboard.py `get_current_period`, reading
// `datetime.now(UTC+3)`); GET /workspaces/{id}/dashboard exposes no period
// argument, so `page.clock` cannot shift that window and a fixed July 2026 date
// falls outside it in any other month. The seeded day is therefore derived from
// the period actually under test, and the expected rendering is derived from
// the same value so the assertion stays exact rather than pattern-only.
const seededDate = currentPeriodDate();
const seededDisplayDate = toDisplayDate(seededDate);

test.describe("F-001 isolated dates", () => {
  test.skip(!hasE2eEnvironment, "Set local Supabase credentials to run F-001 checks.");

  test("renders DD/MM/YYYY dates left-to-right in cards, lists, forms, and filters", async ({ page }) => {
    const user = await createSeededUser();
    const workspace = await seedWorkspace(user);
    await seedIncome(user, workspace.id, seededDate);
    await signIn(page, "ar", user);

    await page.goto(`/ar/w/${workspace.id}/dashboard`);
    const dashboardDate = page.getByText(seededDisplayDate, { exact: true }).first();
    await expect(dashboardDate).toBeVisible();
    await expect(dashboardDate).toHaveAttribute("dir", "ltr");

    await page.goto(`/ar/w/${workspace.id}/incomes`);
    const listDate = page.getByText(seededDisplayDate, { exact: true }).first();
    await expect(listDate).toHaveAttribute("dir", "ltr");
    const formDate = page.getByLabel(/التاريخ|Date/);
    await formDate.fill("2026-07-14");
    const formPreview = page.getByText("14/07/2026", { exact: true });
    await expect(formPreview).toBeVisible();
    await expect(formPreview).toHaveAttribute("dir", "ltr");

    await page.goto(`/ar/w/${workspace.id}/reports`);
    const startDate = page.getByLabel(/تاريخ البداية|Start date/);
    const endDate = page.getByLabel(/تاريخ النهاية|End date/);
    await startDate.fill("2026-07-01");
    await endDate.fill("2026-07-31");
    for (const expectedDate of ["01/07/2026", "31/07/2026"]) {
      const preview = page.getByText(expectedDate, { exact: true });
      await expect(preview).toBeVisible();
      await expect(preview).toHaveAttribute("dir", "ltr");
    }

    const allRenderedDates = page.locator("[dir='ltr']").filter({ hasText: datePattern });
    await expect(allRenderedDates.first()).toBeVisible();

    await page.goto(`/ar/w/${workspace.id}/incomes`);
    // IncomeHistoryList's desktop view is a labelled <section> (an implicit
    // ARIA "region" landmark), not a <table> — see IncomeHistoryList.tsx.
    const incomeTable = page.getByRole("region", { name: /سجل الدخل|Income history/ });
    const tableDate = incomeTable.locator("[dir='ltr']:visible").filter({ hasText: seededDisplayDate }).first();
    await expect(tableDate).toBeVisible({ timeout: 30_000 });
    await expect(tableDate).toHaveAttribute("dir", "ltr");
  });
});
