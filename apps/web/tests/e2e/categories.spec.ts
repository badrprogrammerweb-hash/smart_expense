import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const memberEmail = process.env.E2E_MEMBER_EMAIL;
const memberPassword = process.env.E2E_MEMBER_PASSWORD;
const viewerEmail = process.env.E2E_VIEWER_EMAIL;
const viewerPassword = process.env.E2E_VIEWER_PASSWORD;
// Every signed-up user also owns their own personal workspace, where they
// are always Owner — role checks must target a team workspace the account
// actually holds Member/Viewer in (see roles.spec.ts).
const teamWorkspaceId = process.env.E2E_TEAM_WORKSPACE_ID;

test.describe("categories", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run category management checks.");

  test("Owner sees default categories and can create, rename, and archive a category", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole("link", { name: "Categories" }).click();
    await expect(page.getByText("Restaurants")).toBeVisible();
    await expect(page.getByText("Groceries")).toBeVisible();
    await expect(page.getByText("Other")).toBeVisible();

    const categoryName = `QA Category ${Date.now()}`;
    await page.getByLabel("Category name").fill(categoryName);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(categoryName)).toBeVisible();

    // Assign the new category to an expense before archiving it, so we can
    // confirm the archived category still displays correctly on that expense.
    await page.getByRole("link", { name: "Expenses" }).click();
    await page.getByLabel("Amount").fill("25.00");
    await page.getByLabel("Date").fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Description").fill("Category archive check");
    await page.getByLabel("Category").selectOption({ label: categoryName });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Category archive check")).toBeVisible();

    await page.getByRole("link", { name: "Categories" }).click();
    const categoryRow = page.locator("li", { hasText: categoryName });
    await categoryRow.getByRole("button", { name: "Rename" }).click();
    const renamedName = `${categoryName} Renamed`;
    // Once editing starts, the row's name text is replaced by an <input>, so
    // `hasText: categoryName` can no longer re-match it. The editing row is
    // instead the only <li> that currently contains a textbox.
    const editingRow = page.locator("li").filter({ has: page.getByRole("textbox") });
    await editingRow.getByRole("textbox").fill(renamedName);
    await editingRow.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(renamedName)).toBeVisible();

    await page.locator("li", { hasText: renamedName }).getByRole("button", { name: "Archive" }).click();
    await expect(page.locator("li", { hasText: renamedName }).getByText("Archived")).toBeVisible();

    // Archived category is excluded from the expense form's picker...
    await page.getByRole("link", { name: "Expenses" }).click();
    const categorySelect = page.getByLabel("Category");
    await expect(categorySelect.locator("option", { hasText: "Restaurants" })).toHaveCount(1);
    const categoryOptions = await categorySelect.locator("option").allTextContents();
    expect(categoryOptions).not.toContain(renamedName);

    // ...but the earlier expense that already used it still shows the name.
    const archivedExpenseRow = page.locator("li", { hasText: "Category archive check" });
    await expect(archivedExpenseRow.getByText(renamedName)).toBeVisible();
  });

  test.describe("member and viewer see no category management controls", () => {
    test.skip(
      !memberEmail || !memberPassword || !viewerEmail || !viewerPassword || !teamWorkspaceId,
      "Set member/viewer E2E credentials and E2E_TEAM_WORKSPACE_ID to run category permission checks.",
    );

    test("Member and Viewer cannot create, rename, or archive categories", async ({ page }) => {
      await page.goto("/en/sign-in");
      await page.getByLabel("Email").fill(memberEmail!);
      await page.getByLabel("Password").fill(memberPassword!);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL(/\/en\/w\/.+\/dashboard$/);
      await page.goto(`/en/w/${teamWorkspaceId}/categories`);
      await expect(page.getByText("Restaurants")).toBeVisible();
      await expect(page.getByRole("button", { name: /Rename|Archive|Unarchive/ })).toHaveCount(0);
      await expect(page.getByLabel("Category name")).toHaveCount(0);

      await page.getByRole("button", { name: "Sign out" }).click();
      await page.waitForURL(/\/en\/sign-in$/);
      await page.getByLabel("Email").fill(viewerEmail!);
      await page.getByLabel("Password").fill(viewerPassword!);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL(/\/en\/w\/.+\/dashboard$/);
      await page.goto(`/en/w/${teamWorkspaceId}/categories`);
      await expect(page.getByText("Restaurants")).toBeVisible();
      await expect(page.getByRole("button", { name: /Rename|Archive|Unarchive/ })).toHaveCount(0);
      await expect(page.getByLabel("Category name")).toHaveCount(0);
    });
  });
});
