import { expect, test } from "@playwright/test";
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
  const email = `acc-localization-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
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

type CoreRoute = {
  path: string;
  english: string;
  arabic: string;
};

const coreRoutes: CoreRoute[] = [
  { path: "dashboard", english: enMessages.dashboard.title, arabic: arMessages.dashboard.title },
  { path: "incomes", english: enMessages.records.addIncome, arabic: arMessages.records.addIncome },
  { path: "expenses", english: enMessages.records.addExpense, arabic: arMessages.records.addExpense },
  { path: "reports", english: enMessages.reports.title, arabic: arMessages.reports.title },
  { path: "history", english: enMessages.history.title, arabic: arMessages.history.title },
  { path: "settings", english: enMessages.settings.title, arabic: arMessages.settings.title },
  {
    path: "extractions",
    english: enMessages.extraction.queue.emptyState,
    arabic: arMessages.extraction.queue.emptyState,
  },
];

test.describe("acceptance localization and RTL", () => {
  test.skip(
    !supabaseUrl || !supabaseAnonKey,
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to run localization acceptance checks.",
  );

  test("switches every core route between English LTR and Arabic RTL with SAR amounts", async ({ page }) => {
    const user = await signUp();
    await page.goto("/en/sign-in");
    await page.getByLabel(enMessages.auth.email).fill(user.email);
    await page.getByLabel(enMessages.auth.password).fill(user.password);
    await page.getByRole("button", { name: enMessages.auth.signIn }).click();
    await page.waitForURL(/\/en\/w\/[^/]+\/dashboard$/);

    const workspaceId = new URL(page.url()).pathname.split("/")[3];
    expect(workspaceId).toBeTruthy();

    for (const route of coreRoutes) {
      await page.goto(`/en/w/${workspaceId}/${route.path}`);
      await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
      await expect(page.getByText(route.english, { exact: true }).first()).toBeVisible();
    }

    await page.goto(`/en/w/${workspaceId}/settings`);
    await page.getByRole("button", { name: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629" }).click();
    await page.waitForURL(new RegExp(`/ar/w/${workspaceId}/settings$`));

    for (const route of coreRoutes) {
      await page.goto(`/ar/w/${workspaceId}/${route.path}`);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.getByText(route.arabic, { exact: true }).first()).toBeVisible();
    }

    await page.goto(`/ar/w/${workspaceId}/dashboard`);
    await expect(page.getByText(/(?:SAR|\u0631\.\u0633\.)/).first()).toBeVisible();
  });
});
