import { expect, test, type Browser, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import arMessages from "../messages/ar.json";
import enMessages from "../messages/en.json";

type TestUser = {
  email: string;
  password: string;
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function signUp(): Promise<TestUser> {
  const email = `locale-pref-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
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

  return { email, password };
}

async function signIn(page: Page, user: TestUser, locale: "en" | "ar" = "en") {
  const messages = locale === "ar" ? arMessages : enMessages;
  await page.goto(`/${locale}/sign-in`);
  await page.getByLabel(messages.auth.email).fill(user.email);
  await page.getByLabel(messages.auth.password).fill(user.password);
  await page.getByRole("button", { name: messages.auth.signIn }).click();
}

async function signInFresh(browser: Browser, user: TestUser, startLocale: "en" | "ar" = "en") {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, user, startLocale);
  return { context, page };
}

test.describe("locale preference persistence", () => {
  test.skip(
    !supabaseUrl || !supabaseAnonKey,
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to run locale preference persistence checks.",
  );

  test("stores Arabic and English preferences and applies them after cookies are cleared", async ({
    browser,
    page,
  }) => {
    const user = await signUp();

    await signIn(page, user, "en");
    await page.waitForURL(/\/en\/w\/[^/]+\/dashboard$/);
    await page.getByRole("link", { name: enMessages.nav.settings }).click();
    await page.waitForURL(/\/en\/w\/[^/]+\/settings$/);
    await page.getByRole("button", { name: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629" }).click();
    await page.waitForURL(/\/ar\/w\/[^/]+\/settings$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const arabicSession = await signInFresh(browser, user, "en");
    try {
      await arabicSession.page.waitForURL(/\/ar\/w\/[^/]+\/dashboard$/);
      await expect(arabicSession.page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(arabicSession.page.getByRole("heading", { name: arMessages.dashboard.title })).toBeVisible();

      await arabicSession.page.getByRole("link", { name: arMessages.nav.settings }).click();
      await arabicSession.page.waitForURL(/\/ar\/w\/[^/]+\/settings$/);
      await arabicSession.page.getByRole("button", { name: "English" }).click();
      await arabicSession.page.waitForURL(/\/en\/w\/[^/]+\/settings$/);
      await expect(arabicSession.page.locator("html")).toHaveAttribute("dir", "ltr");
    } finally {
      await arabicSession.context.close();
    }

    const englishSession = await signInFresh(browser, user, "ar");
    try {
      await englishSession.page.waitForURL(/\/en\/w\/[^/]+\/dashboard$/);
      await expect(englishSession.page.locator("html")).toHaveAttribute("dir", "ltr");
      await expect(englishSession.page.getByRole("heading", { name: enMessages.dashboard.title })).toBeVisible();
    } finally {
      await englishSession.context.close();
    }
  });
});
