import type { Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const localeViewportMatrix = [
  { locale: "ar", viewport: "phone", width: 390, height: 844 },
  { locale: "ar", viewport: "tablet", width: 768, height: 1024 },
  { locale: "ar", viewport: "desktop", width: 1440, height: 960 },
  { locale: "en", viewport: "phone", width: 390, height: 844 },
  { locale: "en", viewport: "tablet", width: 768, height: 1024 },
  { locale: "en", viewport: "desktop", width: 1440, height: 960 },
] as const;

export type SeededUser = {
  email: string;
  password: string;
  accessToken: string;
};

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [name, ...rest] = trimmed.split("=");
    if (!process.env[name]) process.env[name] = rest.join("=").replace(/^['"]|['"]$/g, "");
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

type SeededWorkspace = {
  id: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export const hasE2eEnvironment = Boolean(supabaseUrl && supabaseAnonKey);

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Set ${name} before using the E2E seed helpers.`);
  }

  return value;
}

export async function createSeededUser(): Promise<SeededUser> {
  const timestamp = Date.now();
  const email = `refresh-${timestamp}-${Math.random().toString(16).slice(2)}@example.com`;
  const password = `Refresh-${timestamp}-A1`;
  const response = await fetch(`${required(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL")}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: required(supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as { access_token?: string; session?: { access_token?: string } };
  const accessToken = payload.access_token ?? payload.session?.access_token;
  if (!accessToken) {
    throw new Error("The seeded user did not receive an access token.");
  }

  return { email, password, accessToken };
}

export async function seedWorkspace(user: SeededUser, name = `Refresh ${Date.now()}`, currency?: string): Promise<SeededWorkspace> {
  const response = await fetch(`${apiUrl}/workspaces`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const workspace = (await response.json()) as SeededWorkspace;
  if (currency) {
    const currencyResponse = await fetch(`${apiUrl}/workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${user.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ currency }),
    });
    if (!currencyResponse.ok) throw new Error(await currencyResponse.text());
  }
  return workspace;
}

export async function seedIncome(user: SeededUser, workspaceId: string) {
  const response = await fetch(`${apiUrl}/workspaces/${workspaceId}/incomes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${user.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount_minor: 125_000, occurred_on: "2026-07-13", description: "RTL regression income" }),
  });
  if (!response.ok) throw new Error(await response.text());
}

export async function addWorkspaceMember(owner: SeededUser, workspaceId: string, email: string, role: "admin" | "member" | "viewer") {
  const response = await fetch(`${apiUrl}/workspaces/${workspaceId}/members`, {
    method: "POST",
    headers: { Authorization: `Bearer ${owner.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
  if (!response.ok) throw new Error(await response.text());
}

export async function signIn(page: Page, locale: "ar" | "en", user: SeededUser) {
  await page.goto(`/${locale}/sign-in`);
  await page.getByLabel(/email|\u0627\u0644\u0628\u0631\u064a\u062f/i).fill(user.email);
  await page.getByLabel(/password|\u0643\u0644\u0645\u0629/i).fill(user.password);
  await page.getByRole("button", { name: /sign in|\u062a\u0633\u062c\u064a\u0644/i }).click();
  await page.waitForURL(/\/(?:ar|en)\/w\/[^/]+\/dashboard$/, { timeout: 30_000 });
}
