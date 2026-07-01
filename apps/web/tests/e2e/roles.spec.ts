import { expect, test } from "@playwright/test";

const memberEmail = process.env.E2E_MEMBER_EMAIL;
const memberPassword = process.env.E2E_MEMBER_PASSWORD;
const viewerEmail = process.env.E2E_VIEWER_EMAIL;
const viewerPassword = process.env.E2E_VIEWER_PASSWORD;
// Every signed-up user also owns their own personal workspace, where they
// are always Owner. Role checks must target a team workspace the account
// holds Member/Viewer in specifically — the default post-sign-in landing
// (last-active-or-personal) is not that workspace.
const teamWorkspaceId = process.env.E2E_TEAM_WORKSPACE_ID;

test.describe("role visibility", () => {
  test.skip(
    !memberEmail || !memberPassword || !viewerEmail || !viewerPassword || !teamWorkspaceId,
    "Set E2E_MEMBER_EMAIL, E2E_MEMBER_PASSWORD, E2E_VIEWER_EMAIL, E2E_VIEWER_PASSWORD, and E2E_TEAM_WORKSPACE_ID to run role visibility checks.",
  );

  test("member and viewer roles see only permitted record actions", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(memberEmail!);
    await page.getByLabel("Password").fill(memberPassword!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/en\/w\/.+\/dashboard$/);
    await page.goto(`/en/w/${teamWorkspaceId}/dashboard`);
    await expect(page.getByText("Total income")).toBeVisible();
    await expect(page.getByRole("link", { name: "Incomes" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Expenses" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/en\/sign-in$/);
    await page.getByLabel("Email").fill(viewerEmail!);
    await page.getByLabel("Password").fill(viewerPassword!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/en\/w\/.+\/dashboard$/);
    await page.goto(`/en/w/${teamWorkspaceId}/dashboard`);
    await expect(page.getByText("Total income")).toBeVisible();
    await expect(page.getByRole("link", { name: "Incomes" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Expenses" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Save|Delete|Edit/ })).toHaveCount(0);
  });
});
