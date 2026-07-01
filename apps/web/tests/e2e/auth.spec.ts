import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const workspaceId = process.env.E2E_WORKSPACE_ID;

test.describe("auth flow", () => {
  test.skip(!email || !password || !workspaceId, "Set E2E_EMAIL, E2E_PASSWORD, and E2E_WORKSPACE_ID to run auth flow.");

  test("sign-in, sign-out, and protected workspace redirects work", async ({ page, context }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/w\/.+\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/en\/sign-in/);

    const privatePage = await context.newPage();
    await privatePage.goto(`/en/w/${workspaceId}/dashboard`);
    await expect(privatePage).toHaveURL(/\/en\/sign-in/);
  });
});
