import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("workspace switch", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run workspace switch checks.");

  test("create, isolate, and switch back into a team workspace; land on the most recently active workspace after sign-in", async ({
    page,
  }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/en\/w\/.+\/dashboard$/);
    await expect(page.getByText("Total income")).toBeVisible();

    await page.getByRole("link", { name: "Create a team workspace" }).click();
    await page.waitForURL(/\/new-workspace$/);
    const teamName = `Test Team ${Date.now()}`;
    await page.getByLabel("Workspace name").fill(teamName);
    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/dashboard$/);
    const teamUrl = page.url();
    await expect(page.getByRole("heading", { name: teamName })).toBeVisible();
    await expect(page.getByText("SAR 0.00").first()).toBeVisible();

    await page.getByRole("link", { name: "Expenses" }).click();
    await page.waitForURL(/\/expenses$/);
    await page.getByLabel("Amount").fill("60.00");
    await page.getByLabel("Date").fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Description").fill("Team lunch");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Team lunch")).toBeVisible();

    // Switch back to the personal workspace and confirm isolation.
    await page.getByLabel("Switch workspace").selectOption({ label: "Personal Workspace (Personal)" });
    await page.waitForURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Personal Workspace" })).toBeVisible();
    await expect(page.getByText("Team lunch")).toHaveCount(0);

    // Switch back into the team workspace, making it the most recently
    // viewed one, then sign out and back in.
    await page.getByLabel("Switch workspace").selectOption({ label: `${teamName} (Team)` });
    await page.waitForURL(teamUrl);
    await expect(page.getByRole("heading", { name: teamName })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/en\/sign-in$/);
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/en\/w\/.+\/dashboard$/);
    await expect(page.getByRole("heading", { name: teamName })).toBeVisible();
  });
});
