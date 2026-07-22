import { expect, test } from "@playwright/test";

import { addWorkspaceMember, createSeededUser, hasE2eEnvironment, seedWorkspace, signIn } from "./_helpers/matrix";

const copy = {
  ar: {
    empty: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0633\u062c\u0644\u0627\u062a \u0645\u0624\u0643\u062f\u0629 \u0628\u0639\u062f",
    permission: "\u062f\u0648\u0631\u0643 \u0627\u0644\u062d\u0627\u0644\u064a \u064a\u0633\u0645\u062d \u0628\u0639\u0631\u0636 \u0645\u0633\u0627\u062d\u0629 \u0627\u0644\u0639\u0645\u0644 \u0641\u0642\u0637 \u0648\u0644\u0627 \u064a\u0633\u0645\u062d \u0628\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0633\u062c\u0644\u0627\u062a.",
  },
  en: {
    empty: "No confirmed records yet",
    permission: "Your current role can view this workspace but cannot modify records.",
  },
} as const;

test.describe("design refresh feedback states", () => {
  test.skip(!hasE2eEnvironment, "Set local Supabase credentials to run refresh state checks.");

  for (const locale of ["ar", "en"] as const) {
    test(`renders empty, loading, error, and viewer-denied states in ${locale}`, async ({ page }) => {
      const owner = await createSeededUser();
      const viewer = await createSeededUser();
      const workspace = await seedWorkspace(owner, `State ${locale}`);
      await addWorkspaceMember(owner, workspace.id, viewer.email, "viewer");
      await signIn(page, locale, owner);

      await page.goto(`/${locale}/w/${workspace.id}/dashboard`);
      await expect(page.getByRole("heading", { name: copy[locale].empty })).toBeVisible();

      await page.route(`**/workspaces/${workspace.id}/dashboard**`, async () => {
        await new Promise(() => undefined);
      });
      await page.goto(`/${locale}/w/${workspace.id}/dashboard`);
      await expect(page.getByRole("status")).toBeVisible();
      await page.unroute(`**/workspaces/${workspace.id}/dashboard**`);

      await page.route(`**/workspaces/${workspace.id}/incomes`, async (route) => {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "request_failed", message: "Request failed" } }) });
      });
      await page.goto(`/${locale}/w/${workspace.id}/incomes`);
      await expect(page.getByRole("alert")).toBeVisible();
      await page.unroute(`**/workspaces/${workspace.id}/incomes`);

      await signIn(page, locale, viewer);
      await page.goto(`/${locale}/w/${workspace.id}/expenses`);
      const denied = page.getByTestId("permission-denied-state");
      await expect(denied).toBeVisible();
      await expect(denied).toContainText(copy[locale].permission);
    });
  }
});
