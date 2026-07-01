import { expect, test } from "@playwright/test";

test.describe("role visibility", () => {
  test.skip(
    !process.env.E2E_MEMBER_EMAIL ||
      !process.env.E2E_MEMBER_PASSWORD ||
      !process.env.E2E_VIEWER_EMAIL ||
      !process.env.E2E_VIEWER_PASSWORD,
    "Set member/viewer E2E credentials to run role visibility checks.",
  );

  test("member and viewer roles see only permitted record actions", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(process.env.E2E_MEMBER_EMAIL!);
    await page.getByLabel("Password").fill(process.env.E2E_MEMBER_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("link", { name: "Incomes" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Expenses" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByLabel("Email").fill(process.env.E2E_VIEWER_EMAIL!);
    await page.getByLabel("Password").fill(process.env.E2E_VIEWER_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("link", { name: "Incomes" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Expenses" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Save|Delete|Edit/ })).toHaveCount(0);
  });
});
