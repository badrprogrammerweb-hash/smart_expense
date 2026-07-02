import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const memberEmail = process.env.E2E_MEMBER_EMAIL;
const memberPassword = process.env.E2E_MEMBER_PASSWORD;
const viewerEmail = process.env.E2E_VIEWER_EMAIL;
const viewerPassword = process.env.E2E_VIEWER_PASSWORD;
// Every signed-up user also owns their own personal workspace, where they
// are always Owner. Role checks must target a team workspace the account
// holds Member/Viewer in specifically — the default post-sign-in landing
// (last-active-or-personal) is not that workspace. E2E_EMAIL/PASSWORD is the
// Owner of that same team workspace (see workspace-switch.spec.ts).
const teamWorkspaceId = process.env.E2E_TEAM_WORKSPACE_ID;

async function signIn(page: Page, signInEmail: string, signInPassword: string) {
  await page.goto("/en/sign-in");
  await page.getByLabel("Email").fill(signInEmail);
  await page.getByLabel("Password").fill(signInPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/w\/.+\/dashboard$/);
}

test.describe("role visibility", () => {
  test.skip(
    !email || !password || !memberEmail || !memberPassword || !viewerEmail || !viewerPassword || !teamWorkspaceId,
    "Set E2E_EMAIL, E2E_PASSWORD, E2E_MEMBER_EMAIL, E2E_MEMBER_PASSWORD, E2E_VIEWER_EMAIL, E2E_VIEWER_PASSWORD, and E2E_TEAM_WORKSPACE_ID to run role visibility checks.",
  );

  test("member and viewer roles see only permitted record actions", async ({ page }) => {
    const ownerExpenseDescription = `Owner expense ${Date.now()}`;
    const memberExpenseDescription = `Member expense ${Date.now()}`;

    // Owner seeds an expense in the team workspace for the Member/Viewer
    // checks below to target.
    await signIn(page, email!, password!);
    await page.goto(`/en/w/${teamWorkspaceId}/expenses`);
    await page.getByLabel("Amount").fill("10.00");
    await page.getByLabel("Date").fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Description").fill(ownerExpenseDescription);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(ownerExpenseDescription)).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/en\/sign-in$/);

    // Member: can create an expense of their own (FR-021), sees edit/delete
    // only on their own row, never on the Owner's, and never sees income
    // anywhere in the workspace.
    await signIn(page, memberEmail!, memberPassword!);
    await page.goto(`/en/w/${teamWorkspaceId}/dashboard`);
    await expect(page.getByText("Total income")).toBeVisible();
    await expect(page.getByRole("link", { name: "Incomes" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Expenses" })).toBeVisible();

    await page.getByRole("link", { name: "Expenses" }).click();
    await page.waitForURL(/\/expenses$/);
    await page.getByLabel("Amount").fill("5.00");
    await page.getByLabel("Date").fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Description").fill(memberExpenseDescription);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(memberExpenseDescription)).toBeVisible();

    const ownerRow = page.locator("li", { hasText: ownerExpenseDescription });
    await expect(ownerRow.getByRole("button", { name: /Edit|Delete/ })).toHaveCount(0);
    const memberRow = page.locator("li", { hasText: memberExpenseDescription });
    await expect(memberRow.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(memberRow.getByRole("button", { name: "Delete" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/en\/sign-in$/);

    // Viewer: no create/edit/delete/archive control anywhere in the
    // workspace — checked on dashboard, expenses, and categories, not just
    // the dashboard landing page.
    await signIn(page, viewerEmail!, viewerPassword!);
    await page.goto(`/en/w/${teamWorkspaceId}/dashboard`);
    await expect(page.getByText("Total income")).toBeVisible();
    await expect(page.getByRole("link", { name: "Incomes" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Expenses" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Save|Delete|Edit|Archive/ })).toHaveCount(0);

    await page.goto(`/en/w/${teamWorkspaceId}/expenses`);
    await expect(page.getByText(ownerExpenseDescription)).toBeVisible();
    await expect(page.getByLabel("Amount")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Save|Delete|Edit|Archive/ })).toHaveCount(0);

    await page.goto(`/en/w/${teamWorkspaceId}/categories`);
    await expect(page.getByText("Restaurants")).toBeVisible();
    await expect(page.getByLabel("Category name")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Save|Delete|Edit|Archive|Rename|Unarchive/ })).toHaveCount(0);
  });
});
