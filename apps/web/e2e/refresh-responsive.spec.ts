import { expect, test } from "@playwright/test";

import { createSeededUser, hasE2eEnvironment, localeViewportMatrix, seedIncome, seedWorkspace, signIn } from "./_helpers/matrix";

const labels = {
  ar: {
    addExpense: "\u0625\u0636\u0627\u0641\u0629 \u0645\u0635\u0631\u0648\u0641",
    addIncome: "\u0625\u0636\u0627\u0641\u0629 \u062f\u062e\u0644",
    extraction: "\u0645\u0631\u0627\u062c\u0639\u0627\u062a \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a",
    extractionEmpty: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0639\u0645\u0644\u064a\u0627\u062a \u0627\u0633\u062a\u062e\u0631\u0627\u062c \u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629.",
    fileUpload: "\u0631\u0641\u0639 \u0645\u0644\u0641",
    incomeHistory: "\u0633\u062c\u0644 \u0627\u0644\u062f\u062e\u0644",
    navigation: "\u0627\u0644\u062a\u0646\u0642\u0644",
    openNavigation: "\u0641\u062a\u062d \u0627\u0644\u062a\u0646\u0642\u0644",
    switchWorkspace: "\u062a\u0628\u062f\u064a\u0644 \u0645\u0633\u0627\u062d\u0629 \u0627\u0644\u0639\u0645\u0644",
  },
  en: {
    addExpense: "Add expense",
    addIncome: "Add income",
    extraction: "AI reviews",
    extractionEmpty: "No extractions waiting for review.",
    fileUpload: "Upload file",
    incomeHistory: "Income history",
    navigation: "Navigation",
    openNavigation: "Open navigation",
    switchWorkspace: "Switch workspace",
  },
} as const;

test.describe("design refresh responsive workflows", () => {
  test.setTimeout(180_000);
  test.skip(!hasE2eEnvironment, "Set local Supabase credentials to run responsive refresh checks.");

  test("keeps key workflows reachable across locale and viewport matrix", async ({ page }) => {
    const user = await createSeededUser();
    const workspace = await seedWorkspace(user, "Responsive primary");
    const alternateWorkspace = await seedWorkspace(user, "Responsive alternate");
    await seedIncome(user, workspace.id);

    await signIn(page, "en", user);

    for (const scenario of localeViewportMatrix) {
      const copy = labels[scenario.locale];
      await page.setViewportSize({ width: scenario.width, height: scenario.height });
      await page.goto(`/${scenario.locale}/w/${workspace.id}/dashboard`);

      await expect(page.getByText(/Remaining balance|\u0627\u0644\u0631\u0635\u064a\u062f \u0627\u0644\u0645\u062a\u0628\u0642\u064a/)).toBeVisible();

      if (scenario.width < 1024) {
        await page.getByRole("button", { name: copy.openNavigation }).click();
        const drawer = page.getByRole("dialog", { name: copy.navigation });
        await expect(drawer).toBeVisible();
        await drawer.getByRole("link", { name: copy.addExpense }).click();
      } else {
        await page.getByRole("link", { name: copy.addExpense }).last().click();
      }
      await expect(page.getByLabel(/Amount|\u0627\u0644\u0645\u0628\u0644\u063a/)).toBeVisible();

      if (scenario.width < 1024) {
        await page.getByRole("button", { name: copy.openNavigation }).click();
        await page.getByRole("dialog", { name: copy.navigation }).getByRole("link", { name: copy.addIncome }).click();
      } else {
        await page.goto(`/${scenario.locale}/w/${workspace.id}/dashboard`);
        await page.getByRole("link", { name: copy.addIncome }).last().click();
      }
      await expect(page.getByLabel(/Amount|\u0627\u0644\u0645\u0628\u0644\u063a/)).toBeVisible();
      if (scenario.width < 768) {
        await expect(page.getByTestId("mobile-record-card")).toBeVisible();
      } else {
        // IncomeHistoryList's desktop view is a labelled <section> (an
        // implicit ARIA "region" landmark via its aria-label), not a
        // <table> — it renders a <ul>/<li> list, so role="table" would be
        // an invalid ARIA structure (see IncomeHistoryList.tsx).
        await expect(page.getByRole("region", { name: copy.incomeHistory })).toBeVisible();
      }

      await page.goto(`/${scenario.locale}/w/${workspace.id}/files`);
      await expect(page.getByRole("button", { name: copy.fileUpload })).toBeVisible();

      await page.goto(`/${scenario.locale}/w/${workspace.id}/extractions`);
      await expect(page.getByRole("heading", { name: copy.extractionEmpty })).toBeVisible();

      await page.goto(`/${scenario.locale}/w/${workspace.id}/reports`);
      await page.getByLabel(/Start date|\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0628\u062f\u0627\u064a\u0629/).fill("2026-07-01");
      await page.getByLabel(/End date|\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0646\u0647\u0627\u064a\u0629/).fill("2026-07-31");

      await page.goto(`/${scenario.locale}/w/${workspace.id}/dashboard`);
      const workspaceSelector = page.getByLabel(copy.switchWorkspace);
      await expect(workspaceSelector.locator(`option[value="${alternateWorkspace.id}"]`)).toHaveCount(1);
      await workspaceSelector.selectOption(alternateWorkspace.id);
      await expect(page).toHaveURL(new RegExp(`/${scenario.locale}/w/${alternateWorkspace.id}/dashboard$`));
    }
  });
});
