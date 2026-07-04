import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import arMessages from "../messages/ar.json";

type TestUser = {
  email: string;
  password: string;
  token: string;
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
      process.env[name] = rest.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const openAiKey = "sk-test-0000000000000000abcd";
const openAiReplacementKey = "sk-test-1111111111111111wxyz";

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
  const token = payload.access_token ?? payload.session?.access_token;
  expect(token).toBeTruthy();
  return { email, password, token };
}

async function apiFetch(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response;
}

async function createWorkspace(owner: TestUser, viewer: TestUser) {
  const workspaceResponse = await apiFetch("/workspaces", owner.token, {
    method: "POST",
    body: JSON.stringify({ name: `AI Settings E2E ${Date.now()}` }),
  });
  const workspace = await workspaceResponse.json();

  await apiFetch(`/workspaces/${workspace.id}/members`, owner.token, {
    method: "POST",
    body: JSON.stringify({ email: viewer.email, role: "viewer" }),
  });

  return workspace.id as string;
}

async function signIn(page: Page, user: TestUser) {
  await page.goto("/en/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/w\/.+\/dashboard$/);
}

test.describe("AI settings", () => {
  test.skip(
    !supabaseUrl || !supabaseAnonKey,
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to run AI settings e2e checks.",
  );

  test("owner configures, replaces, and removes while viewer sees read-only status", async ({
    page,
  }) => {
    const owner = await signUp("ai-settings-owner");
    const viewer = await signUp("ai-settings-viewer");
    const workspaceId = await createWorkspace(owner, viewer);
    const aiResponseBodies: Promise<string>[] = [];

    page.on("response", (response) => {
      if (response.url().includes(`/workspaces/${workspaceId}/ai-settings`)) {
        aiResponseBodies.push(response.text().catch(() => ""));
      }
    });

    await signIn(page, owner);
    await page.goto(`/en/w/${workspaceId}/settings`);
    await expect(page.getByRole("heading", { name: "AI settings", exact: true })).toBeVisible();
    await expect(page.getByText("Not configured", { exact: true })).toBeVisible();

    await page.getByLabel("Provider").selectOption("openai");
    await page.getByLabel("API key").fill(openAiKey);
    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/workspaces/${workspaceId}/ai-settings`) &&
        response.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Save" }).click();
    expect(await (await createResponse).text()).not.toContain(openAiKey);
    await expect(page.getByText("Configured", { exact: true })).toBeVisible();
    await expect(page.getByText(/abcd/)).toBeVisible();

    await page.getByLabel("New API key").fill(openAiReplacementKey);
    const replaceResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/workspaces/${workspaceId}/ai-settings`) &&
        response.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Replace key" }).click();
    expect(await (await replaceResponse).text()).not.toContain(openAiReplacementKey);
    await expect(page.getByText(/wxyz/)).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/en\/sign-in$/);

    await signIn(page, viewer);
    await page.goto(`/en/w/${workspaceId}/settings`);
    await expect(page.getByText("Configured", { exact: true })).toBeVisible();
    await expect(page.getByText(/wxyz/)).toBeVisible();
    await expect(page.getByLabel("New API key")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove key" })).toHaveCount(0);

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/en\/sign-in$/);

    await signIn(page, owner);
    await page.goto(`/ar/w/${workspaceId}/settings`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", { name: arMessages.aiSettings.title, exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel(arMessages.aiSettings.providerLabel)).toBeVisible();
    await expect(page.getByText(arMessages.aiSettings.status.configured, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: arMessages.aiSettings.removeAction }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(arMessages.aiSettings.removeTitle)).toBeVisible();
    await page.getByRole("button", { name: arMessages.common.confirm }).click();
    await expect(page.getByText(arMessages.aiSettings.status.notConfigured, { exact: true })).toBeVisible();

    const bodies = (await Promise.all(aiResponseBodies)).join("\n");
    expect(bodies).not.toContain(openAiKey);
    expect(bodies).not.toContain(openAiReplacementKey);
  });
});
