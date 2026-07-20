import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import arMessages from "../../messages/ar.json";
import enMessages from "../../messages/en.json";

type TestUser = {
  email: string;
  password: string;
  accessToken: string;
};

function loadEnvFile(path: string) {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [name, ...rest] = trimmed.split("=");
    if (!process.env[name]) {
      process.env[name] = rest.join("=").replace(/^['"]|['"]$/g, "");
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function signUp(prefix: string): Promise<TestUser> {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const password = `Correct-${Date.now()}-A1`;
  const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = await response.json();
  const accessToken = payload.access_token ?? payload.session?.access_token;
  expect(accessToken).toBeTruthy();
  return { email, password, accessToken };
}

async function apiFetch<T>(path: string, user: TestUser, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${user.accessToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as T;
}

async function createKwdWorkspace(user: TestUser) {
  const workspace = await apiFetch<{ id: string }>("/workspaces", user, {
    method: "POST",
    body: JSON.stringify({ name: `RTL KWD ${Date.now()}` }),
  });

  await apiFetch(`/workspaces/${workspace.id}`, user, {
    method: "PATCH",
    body: JSON.stringify({ currency: "KWD" }),
  });

  return workspace.id;
}

async function signIn(page: Page, user: TestUser, locale: "en" | "ar" = "en") {
  await page.goto(`/${locale}/sign-in`);
  await page.getByLabel(locale === "ar" ? arMessages.auth.email : enMessages.auth.email).fill(user.email);
  await page.getByLabel(locale === "ar" ? arMessages.auth.password : enMessages.auth.password).fill(user.password);
  await page.getByRole("button", { name: locale === "ar" ? arMessages.auth.signIn : enMessages.auth.signIn }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/w/.+/dashboard$`), { timeout: 30_000 });
}

test.describe("locale and RTL", () => {
  test.skip(
    !supabaseUrl || !supabaseAnonKey,
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to run locale/RTL checks.",
  );

  test("switching to Arabic sets dir=rtl and translates every screen; switching back restores English", async ({
    page,
  }) => {
    const user = await signUp("locale-rtl-switch");

    await signIn(page, user);

    await page.getByRole("link", { name: enMessages.nav.settings }).click();
    await page.waitForURL(/\/en\/w\/.+\/settings$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { name: enMessages.aiSettings.title })).toBeVisible();
    await expect(page.getByText(enMessages.settings.aiDescription, { exact: false })).toBeVisible();

    // Switching does not require a manual page reload: the same client
    // session keeps navigating (FR-031), and every screen renders RTL with
    // Arabic labels afterward.
    await page.getByRole("button", { name: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629" }).click();
    await page.waitForURL(/\/ar\/w\/.+\/settings$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: arMessages.settings.title })).toBeVisible();
    await expect(page.getByLabel(arMessages.files.autoDelete.label)).toBeVisible();

    await page.getByRole("link", { name: arMessages.nav.dashboard }).click();
    await page.waitForURL(/\/ar\/w\/.+\/dashboard$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText(arMessages.dashboard.totalIncome)).toBeVisible();

    await page.getByRole("link", { name: arMessages.nav.incomes }).click();
    await page.waitForURL(/\/ar\/w\/.+\/incomes$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: arMessages.records.addIncome })).toBeVisible();

    await page.getByRole("link", { name: arMessages.nav.files }).click();
    await page.waitForURL(/\/ar\/w\/.+\/files$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: arMessages.files.title })).toBeVisible();
    await expect(page.getByLabel(arMessages.files.upload.title)).toBeVisible();
    await expect(page.getByRole("button", { name: arMessages.files.upload.action })).toBeVisible();

    await page.getByRole("link", { name: arMessages.nav.categories }).click();
    await page.waitForURL(/\/ar\/w\/.+\/categories$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: arMessages.categories.title })).toBeVisible();

    await page.getByRole("link", { name: arMessages.nav.settings }).click();
    await page.waitForURL(/\/ar\/w\/.+\/settings$/);
    await page.getByRole("button", { name: "English" }).click();
    await page.waitForURL(/\/en\/w\/.+\/settings$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { name: enMessages.settings.title, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: enMessages.aiSettings.title })).toBeVisible();
  });

  test("the chosen language survives sign-out and steers the signed-out root redirect", async ({ page }) => {
    const user = await signUp("locale-rtl-cookie");

    await signIn(page, user);

    await page.getByRole("link", { name: enMessages.nav.settings }).click();
    await page.waitForURL(/\/en\/w\/.+\/settings$/);
    await page.getByRole("button", { name: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629" }).click();
    await page.waitForURL(/\/ar\/w\/.+\/settings$/);

    // Not app state: the language choice's durability across sign-out comes
    // entirely from next-intl's own NEXT_LOCALE cookie, set on every
    // locale-prefixed navigation.
    await page.getByRole("button", { name: arMessages.nav.signOut }).click();
    await page.waitForURL(/\/ar\/sign-in$/);

    await page.goto("/");
    await page.waitForURL(/\/ar\/sign-in$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    // Restore English so the same browser context is left in its default
    // locale for any later checks.
    await page.goto("/en/sign-in");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("a non-SAR workspace keeps LTR and RTL layout while showing KWD amounts", async ({ page }) => {
    const user = await signUp("locale-rtl-kwd");
    const workspaceId = await createKwdWorkspace(user);

    await signIn(page, user);

    await page.goto(`/en/w/${workspaceId}/dashboard`);
    await expect(page).toHaveURL(new RegExp(`/en/w/${workspaceId}/dashboard$`));
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByText(/KWD\s*0\.000/).first()).toBeVisible();

    await page.goto(`/ar/w/${workspaceId}/dashboard`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText(/KWD|\u062f\.\u0643|\u062f\u064a\u0646\u0627\u0631/).first()).toBeVisible();
  });
});
