import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("locale and RTL", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run locale/RTL checks.");

  test("switching to Arabic sets dir=rtl and translates every screen; switching back restores English", async ({
    page,
  }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/en\/w\/.+\/dashboard$/);

    await page.getByRole("link", { name: "Settings" }).click();
    await page.waitForURL(/\/en\/w\/.+\/settings$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { name: "AI review" })).toBeVisible();
    await expect(page.getByText("AI is optional and not yet configured.", { exact: false })).toBeVisible();

    // Switching does not require a manual page reload: the same client
    // session keeps navigating (FR-031), and every screen renders RTL with
    // Arabic labels afterward.
    await page.getByRole("button", { name: "العربية" }).click();
    await page.waitForURL(/\/ar\/w\/.+\/settings$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "الإعدادات" })).toBeVisible();
    await expect(page.getByLabel("الحذف التلقائي بعد الاستخراج")).toBeVisible();

    await page.getByRole("link", { name: "لوحة التحكم" }).click();
    await page.waitForURL(/\/ar\/w\/.+\/dashboard$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("إجمالي الدخل")).toBeVisible();

    await page.getByRole("link", { name: "الدخل" }).click();
    await page.waitForURL(/\/ar\/w\/.+\/incomes$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "إضافة دخل" })).toBeVisible();

    await page.getByRole("link", { name: "الملفات" }).click();
    await page.waitForURL(/\/ar\/w\/.+\/files$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "الملفات" })).toBeVisible();
    await expect(page.getByLabel("رفع إيصال أو فاتورة")).toBeVisible();
    await expect(page.getByRole("button", { name: "رفع ملف" })).toBeVisible();

    await page.getByRole("link", { name: "التصنيفات" }).click();
    await page.waitForURL(/\/ar\/w\/.+\/categories$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "التصنيفات" })).toBeVisible();

    await page.getByRole("link", { name: "الإعدادات" }).click();
    await page.waitForURL(/\/ar\/w\/.+\/settings$/);
    await page.getByRole("button", { name: "English" }).click();
    await page.waitForURL(/\/en\/w\/.+\/settings$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI review" })).toBeVisible();
  });

  test("the chosen language survives sign-out and steers the signed-out root redirect", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/en\/w\/.+\/dashboard$/);

    await page.getByRole("link", { name: "Settings" }).click();
    await page.waitForURL(/\/en\/w\/.+\/settings$/);
    await page.getByRole("button", { name: "العربية" }).click();
    await page.waitForURL(/\/ar\/w\/.+\/settings$/);

    // Not app state: the language choice's durability across sign-out comes
    // entirely from next-intl's own NEXT_LOCALE cookie, set on every
    // locale-prefixed navigation.
    await page.getByRole("button", { name: "تسجيل الخروج" }).click();
    await page.waitForURL(/\/ar\/sign-in$/);

    await page.goto("/");
    await page.waitForURL(/\/ar\/sign-in$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    // Restore English so this shared account does not leave other specs
    // landing in Arabic. Visiting any /en/... path is enough: next-intl's
    // middleware resets NEXT_LOCALE=en on that response.
    await page.goto("/en/sign-in");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });
});
