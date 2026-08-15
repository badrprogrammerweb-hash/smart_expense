import { expect, test } from "@playwright/test";

import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

import { addWorkspaceMember, createSeededUser, hasE2eEnvironment, seedIncome, seedWorkspace, signIn } from "./_helpers/matrix";
import { pinDashboardPeriod, pinReportsPeriod } from "./_helpers/visual-dashboard";

type Locale = "ar" | "en";

const labels = {
  ar: { navigation: "التنقل", openNavigation: "فتح التنقل", switchWorkspace: "تبديل مساحة العمل" },
  en: { navigation: "Navigation", openNavigation: "Open navigation", switchWorkspace: "Switch workspace" },
} as const;

// Readiness conditions below are read out of the application's own message
// catalogue instead of being re-typed as literals, so a copy change cannot
// leave a wait silently pointing at text the app no longer renders — and so
// neither locale's wait can accidentally depend on the other's wording.
const messages = { ar: arMessages, en: enMessages } as Record<Locale, typeof enMessages>;

async function capture(page: import("@playwright/test").Page, name: string) {
  await expect(page).toHaveScreenshot(`${name}.png`, { animations: "disabled" });
}

/**
 * Assert no loading skeleton is on screen.
 *
 * Every `<Skeleton>` in the app is rendered with `label={common("loading")}`
 * (components/ui/skeleton.tsx gives it `role="status"` and that label as its
 * accessible name), so this matches any skeleton on any page in the locale
 * under test.
 *
 * This replaces an earlier `[data-slot="skeleton"]` guard that matched nothing:
 * no component in the app has ever emitted that attribute, so the assertion
 * resolved against an empty locator and passed unconditionally.
 */
async function expectNoLoadingSkeleton(page: import("@playwright/test").Page, locale: Locale) {
  await expect(page.getByRole("status", { name: messages[locale].common.loading })).toHaveCount(0);
}

/**
 * Wait for the dashboard to reach its loaded, data-bearing state.
 *
 * `DashboardPage` early-returns a bare `<Skeleton>` while `useDashboard` is in
 * flight, so nothing below is in the DOM until that query resolves — the `<h1>`
 * is rendered only past that early return. Waiting on it is therefore a real
 * state discriminator rather than a proxy for one.
 *
 * `toHaveScreenshot` alone cannot catch this: it waits for two consecutive
 * identical frames, and a skeleton is static, so a loading frame satisfies its
 * stability check and gets captured as if it were the finished page.
 *
 * The AI notice is the second, easily-missed transition. `RecentActivity`
 * receives `aiConfigured` from a *separate* `ai-settings` query that
 * `dashboard.isLoading` does not gate, so the page first paints complete and
 * only then grows this line — a layout shift after the dashboard already looks
 * ready. A freshly seeded workspace has no AI configuration and the API returns
 * `{configured: false}` with a 200 for that case (apps/api
 * services/ai_settings.py `_status_from_row`), so the notice is guaranteed to
 * appear and is a safe thing to wait for.
 */
async function waitForDashboardReady(page: import("@playwright/test").Page, locale: Locale) {
  const dashboard = messages[locale].dashboard;

  await expect(page.getByRole("heading", { level: 1, name: dashboard.title })).toBeVisible();
  await expect(page.getByText(dashboard.aiUnavailable)).toBeVisible();
  await expectNoLoadingSkeleton(page, locale);
}

/**
 * Wait for the dashboard of a workspace with no records to reach its *empty*
 * state, which is a different rendered outcome from the populated one above.
 *
 * `DashboardPage` renders the empty-state card only when the resolved response
 * has neither recent records nor a category breakdown, so its heading proves
 * both that the query settled and that it settled on the empty branch. The
 * level-2 role match matters: the same `emptyPeriod` string is also used as the
 * category-breakdown card's body copy, and only the empty-state card renders it
 * as a heading.
 */
async function waitForDashboardEmptyState(page: import("@playwright/test").Page, locale: Locale) {
  const dashboard = messages[locale].dashboard;

  await expect(page.getByRole("heading", { level: 1, name: dashboard.title })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: dashboard.emptyPeriod })).toBeVisible();
  await expect(page.getByText(dashboard.aiUnavailable)).toBeVisible();
  await expectNoLoadingSkeleton(page, locale);
}

/**
 * Wait for the reports page to reach its loaded state.
 *
 * `ReportSummary` early-returns a `<Skeleton>` while `useReports` is in flight,
 * so — as on the dashboard — the `<h1>` exists only in the loaded branch. The
 * spending-summary card is asserted as a second, independent confirmation: it
 * is a child of the same loaded branch and renders from the resolved payload,
 * so its heading cannot appear while the report query is still pending.
 */
async function waitForReportsReady(page: import("@playwright/test").Page, locale: Locale) {
  const { reports, summary } = messages[locale];

  await expect(page.getByRole("heading", { level: 1, name: reports.title })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: summary.title })).toBeVisible();
  await expectNoLoadingSkeleton(page, locale);
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

      // The clock freeze above only pins the browser. The dashboard's reporting
      // window is computed server-side, so it must be pinned separately or the
      // captured "Current period" text drifts with the real calendar month —
      // see e2e/_helpers/visual-dashboard.ts.
      await pinDashboardPeriod(page, workspace.id);
      // The reports endpoint resolves its own window from the server clock and
      // is not covered by the dashboard pin, so it needs the same treatment —
      // see e2e/_helpers/visual-dashboard.ts.
      await pinReportsPeriod(page, workspace.id);

      await signIn(page, locale, owner);

      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(`/${locale}/w/${workspace.id}/dashboard`);
      await waitForDashboardReady(page, locale);
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
      // This capture frames a dialog, but the dashboard behind it is in shot —
      // the committed baseline shows its period card — so the page underneath
      // has to be settled too. Awaited before the dialog opens rather than
      // after, so the assertions run against the page in its ordinary state
      // rather than one with a modal over it.
      await waitForDashboardReady(page, locale);
      // The workspace switcher disables itself while its own list is loading
      // (WorkspaceSelector.tsx `disabled={workspaces.isLoading}`), which is
      // visible in the header behind the dialog. Capturing before that query
      // settles caught it mid-load — narrower, greyed, and truncating its
      // label — an unrelated flake rather than a real difference.
      await expect(page.getByLabel(labels[locale].switchWorkspace)).toBeEnabled();
      await page.getByRole("button", { name: labels[locale].openNavigation }).click();
      await expect(page.getByRole("dialog", { name: labels[locale].navigation })).toBeVisible();
      await capture(page, `${locale}-mobile-navigation-dialog`);

      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(`/${locale}/w/${workspace.id}/reports`);
      await waitForReportsReady(page, locale);
      await capture(page, `${locale}-reports`);

      await page.goto(`/${locale}/w/${emptyWorkspace.id}/dashboard`);
      await waitForDashboardEmptyState(page, locale);
      await capture(page, `${locale}-empty-state`);

      await page.route(`**/workspaces/${workspace.id}/incomes`, async (route) => {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "request_failed", message: "Request failed" } }) });
      });
      await page.goto(`/${locale}/w/${workspace.id}/incomes`);

      // A generic getByRole("alert") can match unrelated live regions
      // elsewhere on the page (e.g. dev-mode overlays), so wait on the
      // income list's own error state instead.
      await expect(page.getByTestId("income-error-state")).toBeVisible();

      await expectNoLoadingSkeleton(page, locale);

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
