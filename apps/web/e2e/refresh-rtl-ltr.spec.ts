import { expect, test } from "@playwright/test";

import { createSeededUser, hasE2eEnvironment, seedIncome, seedWorkspace, signIn } from "./_helpers/matrix";

test.describe("design refresh RTL and LTR", () => {
  test.skip(!hasE2eEnvironment, "Set local Supabase credentials to run refresh RTL/LTR checks.");

  test("keeps the shell, record form, navigation dialog, and workspace currency stable across locales", async ({ page }, testInfo) => {
    const user = await createSeededUser();
    const workspace = await seedWorkspace(user, undefined, "KWD");
    await seedIncome(user, workspace.id);

    await signIn(page, "en", user);
    await page.goto(`/en/w/${workspace.id}/dashboard`);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByText(/KWD|KD/).first()).toBeVisible();

    const desktopNav = page.getByRole("navigation", { name: "Workspace navigation" });
    if (testInfo.project.name === "chromium") {
      await expect(desktopNav).toBeVisible();
      const ltrBox = await desktopNav.boundingBox();
      expect(ltrBox?.x).toBeLessThan((page.viewportSize()?.width ?? 0) / 2);
    }

    await page.goto(`/ar/w/${workspace.id}/dashboard`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText(/KWD|د\.ك|دينار/).first()).toBeVisible();
    if (testInfo.project.name === "chromium") {
      const rtlBox = await desktopNav.boundingBox();
      expect((rtlBox?.x ?? 0) + (rtlBox?.width ?? 0)).toBeGreaterThan((page.viewportSize()?.width ?? 0) / 2);
    }

    await page.goto(`/ar/w/${workspace.id}/incomes`);
    await expect(page.getByLabel(/المبلغ|Amount/)).toBeVisible();
    await expect(page.getByLabel(/التاريخ|Date/)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: /فتح التنقل|Open navigation/ }).click();
    await expect(page.getByRole("dialog", { name: /التنقل|Navigation/ })).toBeVisible();
  });
});
