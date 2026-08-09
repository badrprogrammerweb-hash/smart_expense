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

    // A native date input renders its value in the browser/OS locale, which is
    // not the product's DD/MM/YYYY contract. These fields used to carry a
    // DD/MM/YYYY caption directly beneath, so one value appeared twice in two
    // formats and read as two different days (BUG-02). The control now owns the
    // single rendering of its own value, and keeps its ISO machine value.
    const formDate = page.getByLabel(/التاريخ|Date/);
    await formDate.fill("2026-07-14");
    await expect(formDate).toHaveValue("2026-07-14");
    await expect(page.getByText("14/07/2026", { exact: true })).toHaveCount(0);

    await page.goto(`/ar/w/${workspace.id}/reports`);
    const startDate = page.getByLabel(/تاريخ البداية|Start date/);
    const endDate = page.getByLabel(/تاريخ النهاية|End date/);
    await startDate.fill("2026-07-01");
    await endDate.fill("2026-07-31");
    await expect(startDate).toHaveValue("2026-07-01");
    await expect(endDate).toHaveValue("2026-07-31");
    for (const removedCaption of ["01/07/2026", "31/07/2026"]) {
      await expect(page.getByText(removedCaption, { exact: true })).toHaveCount(0);
    }

    // Dates the product renders itself (rather than delegating to a control)
    // still follow the contract and stay LTR-isolated inside the RTL page.
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
