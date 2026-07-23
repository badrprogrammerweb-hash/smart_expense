import { execSync } from "node:child_process";

import { expect, test, type Locator, type Page } from "@playwright/test";

import arMessages from "../messages/ar.json";
import enMessages from "../messages/en.json";
import { addWorkspaceMember, createSeededUser, hasE2eEnvironment, seedWorkspace, signIn, type SeededUser } from "./_helpers/matrix";

// Matches quickstart.md's own local-stack verification technique, and the
// same technique extraction.spec.ts uses to reach a `ready_for_review` row
// without depending on a real AI provider call.
const DB_CONTAINER = "supabase_db_smart-expense-ai";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

function decodeJwtSub(token: string): string {
  const payloadSegment = token.split(".")[1];
  const payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
  return payload.sub as string;
}

async function apiFetch(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response;
}

async function uploadFileAndGetId(page: Page, locale: "ar" | "en", workspaceId: string, owner: SeededUser, filename: string) {
  await page.goto(`/${locale}/w/${workspaceId}/files`);
  const messages = locale === "ar" ? arMessages : enMessages;
  await page.getByLabel(messages.files.upload.title).setInputFiles({
    name: filename,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nreceipt\n"),
  });
  await page.getByRole("button", { name: messages.files.upload.action }).click();
  await expect(page.getByText(messages.files.upload.success)).toBeVisible();

  const filesResponse = await apiFetch(`/workspaces/${workspaceId}/files`, owner.accessToken);
  const files = (await filesResponse.json()).files as { id: string; original_filename: string }[];
  const match = files.find((file) => file.original_filename === filename);
  expect(match).toBeTruthy();
  return match!.id;
}

function seedReadyForReviewExtraction(params: { workspaceId: string; fileId: string; triggeredBy: string }): string {
  const sql = `
    insert into public.ai_extractions
      (workspace_id, file_id, provider, status, amount_minor, extracted_currency, occurred_on, vendor_name, suggested_category, triggered_by)
    values
      ('${params.workspaceId}', '${params.fileId}', 'openai', 'ready_for_review', 5000, 'SAR', '2026-07-01', 'Mobile Nav Vendor', 'Groceries', '${params.triggeredBy}')
    returning id;
  `;
  return execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -tAq`, {
    input: sql,
    encoding: "utf8",
  }).trim();
}

test.describe("mobile navigation", () => {
  test.skip(!hasE2eEnvironment, "Set local Supabase credentials to exercise mobile navigation.");

  for (const locale of ["en", "ar"] as const) {
    const messages = locale === "ar" ? arMessages : enMessages;

    test(`MI-1, MI-2: bottom nav shows role-permitted destinations with an active indicator, desktop sidebar hidden (${locale})`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === "chromium", "Bottom navigation is intentionally hidden on desktop.");
      const owner = await createSeededUser();
      const workspace = await seedWorkspace(owner);
      await signIn(page, locale, owner);
      await page.goto(`/${locale}/w/${workspace.id}/dashboard`);

      const nav = page.getByRole("navigation", { name: messages.nav.bottomNav });
      await expect(nav).toBeVisible();
      // Owner sees dashboard, incomes, expenses, files in the first four slots.
      const links = nav.getByRole("link");
      await expect(links).toHaveCount(4);
      await expect(links.first()).toHaveAttribute("aria-current", "page");
      await expect(nav.getByRole("button", { name: messages.nav.more })).toBeVisible();

      // N-1: the desktop sidebar is unchanged above `lg` but hidden below it.
      await expect(page.getByRole("navigation", { name: "Workspace navigation" })).toBeHidden();
    });
  }

  test("MI-3: Arabic mirrors the bottom nav's visual order and the drawer's content order relative to English", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium", "Bottom navigation is intentionally hidden on desktop.");
    const owner = await createSeededUser();
    const workspace = await seedWorkspace(owner);
    // Sign in once as English; the session persists across locale-prefixed
    // navigation (matches acc-localization-rtl.spec.ts), so switching to
    // Arabic below is a direct `goto`, never a second sign-in.
    await signIn(page, "en", owner);

    async function itemCenters(locale: "ar" | "en") {
      await page.goto(`/${locale}/w/${workspace.id}/dashboard`);
      const nav = page.getByRole("navigation", { name: (locale === "ar" ? arMessages : enMessages).nav.bottomNav });
      const links = await nav.getByRole("link").all();
      const centers: number[] = [];
      for (const link of links) {
        const box = await link.boundingBox();
        centers.push(box!.x + box!.width / 2);
      }
      return centers;
    }

    const englishCenters = await itemCenters("en");
    const arabicCenters = await itemCenters("ar");

    // Same four destinations in the same DOM (reading) order in both
    // locales -- N-5 relies on logical CSS properties (a plain flex row
    // with no explicit `flex-direction`) so the *visual* order follows the
    // page's `dir` attribute automatically, without reordering the DOM.
    // English must lay out left-to-right; Arabic must lay out
    // right-to-left -- i.e. the visual order is the reverse.
    expect(englishCenters).toEqual([...englishCenters].sort((a, b) => a - b));
    expect(arabicCenters).toEqual([...arabicCenters].sort((a, b) => b - a));

    // Drawer: MobileNavDrawer wraps the shared, centered `Dialog` rather
    // than a slide-in side sheet, so there is no literal "open side" to
    // assert. What genuinely applies -- and is what a centered dialog can
    // mirror -- is that its content's visual order also reverses under RTL.
    async function drawerItemCenters(locale: "ar" | "en") {
      await page.goto(`/${locale}/w/${workspace.id}/dashboard`);
      const messages = locale === "ar" ? arMessages : enMessages;
      await page.getByRole("navigation", { name: messages.nav.bottomNav }).getByRole("button", { name: messages.nav.more }).click();
      const dialog = page.getByRole("dialog", { name: messages.nav.mobileNavigation });
      const links = await dialog.getByRole("link").all();
      const centers: number[] = [];
      for (const link of links) {
        const box = await link.boundingBox();
        centers.push(box!.y + box!.height / 2);
      }
      return centers;
    }

    // The drawer's remaining destinations stack vertically (not
    // horizontally), so there is no horizontal side to mirror -- assert
    // instead that the same remaining destinations render in both locales,
    // in the same (vertical, non-direction-dependent) reading order.
    const englishDrawer = await drawerItemCenters("en");
    const arabicDrawer = await drawerItemCenters("ar");
    expect(englishDrawer.length).toEqual(arabicDrawer.length);
    expect(englishDrawer.length).toBeGreaterThan(0);
  });

  test("MI-4: a Viewer sees no forbidden destination in the bar or the drawer", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium", "Bottom navigation is intentionally hidden on desktop.");
    const owner = await createSeededUser();
    const viewer = await createSeededUser();
    const workspace = await seedWorkspace(owner);
    await addWorkspaceMember(owner, workspace.id, viewer.email, "viewer");

    await signIn(page, "en", viewer);
    await page.goto(`/en/w/${workspace.id}/dashboard`);

    const nav = page.getByRole("navigation", { name: enMessages.nav.bottomNav });
    // A Viewer cannot manage income, create expenses, or view history --
    // those must appear in neither the bar nor the drawer.
    for (const forbidden of ["Incomes", "Expenses", "History"]) {
      await expect(nav.getByRole("link", { name: forbidden })).toHaveCount(0);
    }
    await nav.getByRole("button", { name: enMessages.nav.more }).click();
    const dialog = page.getByRole("dialog", { name: enMessages.nav.mobileNavigation });
    for (const forbidden of ["Incomes", "Expenses", "History"]) {
      await expect(dialog.getByRole("link", { name: forbidden })).toHaveCount(0);
    }
    // Viewer permits dashboard, files, extractions, categories (bar) plus
    // reports, settings (drawer) -- six total, matching lib/permissions.ts.
    await expect(nav.getByRole("link")).toHaveCount(4);
    await expect(dialog.getByRole("link", { name: "Reports" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Settings" })).toBeVisible();
    // A Viewer has no quick actions (cannot create expenses, manage income,
    // or upload files), so the drawer's quick-action list must be empty.
    await expect(dialog.getByRole("link", { name: "Add expense" })).toHaveCount(0);
    await expect(dialog.getByRole("link", { name: "Add income" })).toHaveCount(0);
  });

  test("MI-5: every control in the bottom nav and its drawer meets the 44x44px touch-target minimum", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium", "Bottom navigation is intentionally hidden on desktop.");
    // Scoped to the navigation surfaces this phase introduces. The broader
    // app-wide sweep (T062) is the next test below.
    const owner = await createSeededUser();
    const workspace = await seedWorkspace(owner);
    await signIn(page, "en", owner);
    await page.goto(`/en/w/${workspace.id}/dashboard`);

    const nav = page.getByRole("navigation", { name: enMessages.nav.bottomNav });
    const navControls = [...(await nav.getByRole("link").all()), await nav.getByRole("button", { name: enMessages.nav.more })];
    for (const control of navControls) {
      const box = await control.boundingBox();
      expect(box?.width, "nav control width").toBeGreaterThanOrEqual(44);
      expect(box?.height, "nav control height").toBeGreaterThanOrEqual(44);
    }

    await nav.getByRole("button", { name: enMessages.nav.more }).click();
    const dialog = page.getByRole("dialog", { name: enMessages.nav.mobileNavigation });
    const drawerControls = [...(await dialog.getByRole("link").all()), await dialog.getByRole("button", { name: "Close dialog" })];
    for (const control of drawerControls) {
      const box = await control.boundingBox();
      expect(box?.width, "drawer control width").toBeGreaterThanOrEqual(44);
      expect(box?.height, "drawer control height").toBeGreaterThanOrEqual(44);
    }
  });

  test("T062: touch targets on the Dashboard, Reports, and Settings screens meet the 44x44px minimum", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium", "This audit targets mobile viewports.");
    const owner = await createSeededUser();
    const workspace = await seedWorkspace(owner);
    const categoriesResponse = await apiFetch(`/workspaces/${workspace.id}/categories?category_type=expense`, owner.accessToken);
    const { categories } = (await categoriesResponse.json()) as { categories: { id: string }[] };
    await apiFetch(`/workspaces/${workspace.id}/expenses`, owner.accessToken, {
      method: "POST",
      body: JSON.stringify({ amount_minor: 5000, occurred_on: "2026-07-01", category_id: categories[0].id }),
    });
    await signIn(page, "en", owner);

    // Dashboard: the "Add income"/"Add expense" quick-action links and the
    // category-breakdown drilldown toggle. ("Create a team workspace" is a
    // deliberate exception -- see the comment in WorkspaceSelector.tsx.)
    await page.goto(`/en/w/${workspace.id}/dashboard`);
    for (const name of [enMessages.dashboard.addIncome, enMessages.dashboard.addExpense]) {
      const box = await page.getByRole("link", { name }).boundingBox();
      expect(box?.height, `${name} quick-action link height`).toBeGreaterThanOrEqual(44);
    }
    const breakdownButton = page.locator("section").filter({ hasText: enMessages.dashboard.categoryBreakdown }).getByRole("button").first();
    const breakdownBox = await breakdownButton.boundingBox();
    expect(breakdownBox?.height, "category breakdown row height").toBeGreaterThanOrEqual(44);

    // Reports: the period-preset buttons and the AI-summary request button.
    await page.goto(`/en/w/${workspace.id}/reports`);
    for (const name of [enMessages.reports.periodSelector.current_month, enMessages.reports.periodSelector.previous_month]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box?.height, `${name} preset height`).toBeGreaterThanOrEqual(44);
    }

    // Settings: the language-switcher segmented buttons and the auto-delete checkbox's tap zone.
    await page.goto(`/en/w/${workspace.id}/settings`);
    for (const label of ["English", "العربية"]) {
      const box = await page.getByRole("button", { name: label }).boundingBox();
      expect(box?.height, `${label} language toggle height`).toBeGreaterThanOrEqual(44);
    }
    const checkboxLabelBox = await page.getByLabel(enMessages.files.autoDelete.label).locator("..").boundingBox();
    expect(checkboxLabelBox?.width, "auto-delete tap zone width").toBeGreaterThanOrEqual(44);
    expect(checkboxLabelBox?.height, "auto-delete tap zone height").toBeGreaterThanOrEqual(44);
  });

  test("MI-6: the bottom nav does not occlude the primary action on a form screen", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium", "Bottom navigation is intentionally hidden on desktop.");
    const owner = await createSeededUser();
    const workspace = await seedWorkspace(owner);
    await signIn(page, "en", owner);
    await page.goto(`/en/w/${workspace.id}/expenses`);

    const nav = page.getByRole("navigation", { name: enMessages.nav.bottomNav });
    const submit = page.getByRole("button", { name: enMessages.common.save });
    // Scroll to where a user would actually reach the primary action --
    // boundingBox() otherwise reports the element's natural (pre-scroll)
    // position, which says nothing about occlusion by the fixed bar.
    await submit.scrollIntoViewIfNeeded();
    const navBox = await nav.boundingBox();
    const submitBox = await submit.boundingBox();
    expect(navBox).toBeTruthy();
    expect(submitBox).toBeTruthy();
    // N-9: page content gets bottom padding equal to the bar's height, so
    // the primary submit action's bottom edge sits above the bar's top edge.
    expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(navBox!.y);
  });

  test("MI-11: dialogs and drawers dismiss via their control and the back gesture without leaving the underlying screen", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium", "Bottom navigation is intentionally hidden on desktop.");
    const owner = await createSeededUser();
    const workspace = await seedWorkspace(owner);
    await signIn(page, "en", owner);
    await page.goto(`/en/w/${workspace.id}/dashboard`);
    const dashboardUrl = page.url();

    const nav = page.getByRole("navigation", { name: enMessages.nav.bottomNav });
    const dialog = page.getByRole("dialog", { name: enMessages.nav.mobileNavigation });

    // Dismiss via the dialog's own close control. The backdrop overlay also
    // carries an aria-label of "Close dialog" (it closes the dialog too),
    // so this must be scoped to the dialog's own descendant close button,
    // not `page.getByRole` unscoped, which would match both.
    await nav.getByRole("button", { name: enMessages.nav.more }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close dialog" }).click();
    await expect(dialog).toHaveCount(0);
    expect(page.url()).toBe(dashboardUrl);

    // Dismiss via the device back gesture -- must close the drawer, not
    // navigate the underlying screen away (contract T-3 / Dialog's
    // popstate handling).
    await nav.getByRole("button", { name: enMessages.nav.more }).click();
    await expect(dialog).toBeVisible();
    await page.goBack();
    await expect(dialog).toHaveCount(0);
    expect(page.url()).toBe(dashboardUrl);
  });

  for (const locale of ["en", "ar"] as const) {
    const messages = locale === "ar" ? arMessages : enMessages;

    test(`MI-10: all eight core tasks complete on a mobile viewport (${locale})`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === "chromium", "Bottom navigation is intentionally hidden on desktop.");
      test.setTimeout(180_000);

      const owner = await createSeededUser();
      const workspaceA = await seedWorkspace(owner, `MI-10 A ${Date.now()}`);
      const workspaceB = await seedWorkspace(owner, `MI-10 B ${Date.now()}`);
      await signIn(page, locale, owner);

      // 1. View remaining balance.
      await page.goto(`/${locale}/w/${workspaceA.id}/dashboard`);
      await expect(page.getByText(messages.dashboard.remainingBalance)).toBeVisible();

      // 2. Add an expense (reachable directly from the bottom nav).
      await page.getByRole("navigation", { name: messages.nav.bottomNav }).getByRole("link", { name: messages.nav.expenses }).click();
      // Wait for the new route's form to be the hydrated, interactive one
      // before typing -- otherwise a fill can land mid-navigation and be
      // lost when the client-side route swap finishes mounting the form.
      await expect(page.getByRole("heading", { name: messages.records.addExpense })).toBeVisible();
      await page.getByLabel(messages.records.amount).fill("10.00");
      const expenseResponse = page.waitForResponse((response) => response.url().includes(`/workspaces/${workspaceA.id}/expenses`) && response.request().method() === "POST");
      await page.getByRole("button", { name: messages.common.save }).click();
      await expenseResponse;

      // 3. Add income (owner role permits this).
      await page.getByRole("navigation", { name: messages.nav.bottomNav }).getByRole("link", { name: messages.nav.incomes }).click();
      await expect(page.getByRole("heading", { name: messages.records.addIncome })).toBeVisible();
      await page.getByLabel(messages.records.amount).fill("20.00");
      const incomeResponse = page.waitForResponse((response) => response.url().includes(`/workspaces/${workspaceA.id}/incomes`) && response.request().method() === "POST");
      await page.getByRole("button", { name: messages.common.save }).click();
      await incomeResponse;

      // 4. Upload a receipt.
      const uploadedFileId = await uploadFileAndGetId(page, locale, workspaceA.id, owner, `mi10-${locale}.pdf`);

      // 5. Review an AI extraction -- seeded directly since a real provider
      // call cannot deterministically reach `ready_for_review` in a test.
      const extractionId = seedReadyForReviewExtraction({ workspaceId: workspaceA.id, fileId: uploadedFileId, triggeredBy: decodeJwtSub(owner.accessToken) });
      await page.goto(`/${locale}/w/${workspaceA.id}/extractions/${extractionId}`);
      await expect(page.getByRole("heading", { name: messages.extraction.review.title })).toBeVisible();
      const confirmResponse = page.waitForResponse((response) => response.url().includes(`/extractions/${extractionId}/confirm`));
      await page.getByRole("button", { name: messages.extraction.actions.confirm }).click();
      await confirmResponse;

      // 6. Switch workspace.
      await page.goto(`/${locale}/w/${workspaceA.id}/dashboard`);
      await page.locator("#workspace-switcher").selectOption(workspaceB.id);
      await page.waitForURL(new RegExp(`/${locale}/w/${workspaceB.id}/dashboard$`));

      // 7. Filter records (Reports period preset).
      await page.goto(`/${locale}/w/${workspaceB.id}/reports`);
      const reportsResponse = page.waitForResponse((response) => response.url().includes(`/workspaces/${workspaceB.id}/reports`));
      await page.getByRole("button", { name: messages.reports.periodSelector.previous_month }).click();
      await reportsResponse;

      // 8. Open settings.
      await page.getByRole("navigation", { name: messages.nav.bottomNav }).getByRole("button", { name: messages.nav.more }).click();
      await page.getByRole("dialog", { name: messages.nav.mobileNavigation }).getByRole("link", { name: messages.nav.settings }).click();
      await expect(page.getByRole("heading", { name: messages.settings.title, exact: true })).toBeVisible();
    });
  }

  test("K-4: in-progress form input survives an orientation change across the income, expense, category, AI review, and settings forms", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium", "Orientation rotation is a mobile-viewport concern.");
    test.setTimeout(120_000);
    const owner = await createSeededUser();
    const workspace = await seedWorkspace(owner);
    await signIn(page, "en", owner);

    // Matches the Pixel 7 device profile's own portrait viewport (playwright.config.ts);
    // "landscape" swaps width/height to simulate the orientation change itself,
    // since headless Playwright has no real device to physically rotate.
    const portrait = { width: 412, height: 839 };
    const landscape = { width: 839, height: 412 };

    async function assertSurvivesRotation(field: Locator, value: string) {
      await field.fill(value);
      await expect(field).toHaveValue(value);
      await page.setViewportSize(landscape);
      // The value must still be there after the layout reflows -- if any of
      // these forms held it in DOM state that a viewport-driven remount could
      // drop, rather than in React (react-hook-form or `useState`), this is
      // where it would be lost (contract K-4).
      await expect(field).toHaveValue(value);
      await page.setViewportSize(portrait);
      await expect(field).toHaveValue(value);
    }

    // Expense (react-hook-form).
    await page.goto(`/en/w/${workspace.id}/expenses`);
    await assertSurvivesRotation(page.getByLabel(enMessages.records.amount), "12.34");

    // Income (react-hook-form).
    await page.goto(`/en/w/${workspace.id}/incomes`);
    await assertSurvivesRotation(page.getByLabel(enMessages.records.amount), "56.78");

    // Category (react-hook-form).
    await page.goto(`/en/w/${workspace.id}/categories`);
    await assertSurvivesRotation(page.getByLabel(enMessages.categories.categoryName), "Orientation Test Category");

    // AI review (plain `useState`, not react-hook-form -- K-4 requires
    // React state generally, not react-hook-form specifically).
    const fileId = await uploadFileAndGetId(page, "en", workspace.id, owner, "orientation-test.pdf");
    const extractionId = seedReadyForReviewExtraction({ workspaceId: workspace.id, fileId, triggeredBy: decodeJwtSub(owner.accessToken) });
    await page.goto(`/en/w/${workspace.id}/extractions/${extractionId}`);
    await assertSurvivesRotation(page.getByLabel(enMessages.extraction.review.vendor), "Rotation Vendor");

    // Settings (AI provider key form, plain `useState`).
    await page.goto(`/en/w/${workspace.id}/settings`);
    await assertSurvivesRotation(page.getByLabel(enMessages.aiSettings.keyLabel), "sk-orientation-test-key-value");
  });
});
