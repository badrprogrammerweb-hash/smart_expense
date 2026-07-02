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

  // Local Supabase disables email confirmations (supabase/config.toml
  // enable_confirmations = false), so signUp() returns a session immediately
  // and this exercises the FR-001/SC-001 landing path end-to-end. Gated on
  // the same env vars as the rest of this file only as a signal the local
  // stack is actually up — the fresh account below is generated per run.
  test("sign-up creates an account and lands on its personal workspace dashboard", async ({ page }) => {
    const freshEmail = `e2e-signup-${Date.now()}@example.com`;

    await page.goto("/en/sign-up");
    await page.getByLabel("Email").fill(freshEmail);
    await page.getByLabel("Password").fill("a-valid-password");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/en\/w\/.+\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});
