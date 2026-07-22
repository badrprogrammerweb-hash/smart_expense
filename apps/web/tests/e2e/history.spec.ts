import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

type TestUser = {
  email: string;
  password: string;
};

function readEnv(filePath: string) {
  const values: Record<string, string> = {};
  if (!fs.existsSync(filePath)) {
    return values;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) {
      continue;
    }
    values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

const webEnv = readEnv(path.resolve(process.cwd(), ".env.local"));
const apiEnv = readEnv(path.resolve(process.cwd(), "../api/.env"));
const supabaseUrl = (apiEnv.SUPABASE_URL ?? webEnv.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, "");
const anonKey = webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? apiEnv.SUPABASE_ANON_KEY;
const serviceRoleKey = apiEnv.SUPABASE_SERVICE_ROLE_KEY;
const apiBaseUrl = (webEnv.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

function requireConfig(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is required for history e2e tests.`);
  }
  return value;
}

function testUser(prefix: string): TestUser {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    email: `${prefix}-${suffix}@example.com`,
    password: `Correct-${suffix.slice(0, 12)}-1`,
  };
}

async function createConfirmedUser(user: TestUser) {
  const url = requireConfig(supabaseUrl, "SUPABASE_URL");
  const serviceKey = requireConfig(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      email_confirm: true,
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
  expect(response.ok).toBe(true);
}

async function accessToken(user: TestUser) {
  const url = requireConfig(supabaseUrl, "SUPABASE_URL");
  const key = requireConfig(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
  expect(response.ok).toBe(true);
  const payload = (await response.json()) as { access_token?: string };
  expect(payload.access_token).toBeTruthy();
  return payload.access_token!;
}

async function addViewer(workspaceId: string, owner: TestUser, viewer: TestUser) {
  const token = await accessToken(owner);
  const response = await fetch(`${apiBaseUrl}/workspaces/${workspaceId}/members`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: viewer.email, role: "viewer" }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
  expect(response.ok).toBe(true);
}

async function signIn(page: Page, user: TestUser) {
  await page.goto("/en/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/w\/.+\/dashboard$/);
}

test("owner sees newest history entries and viewer is denied", async ({ page }) => {
  const owner = testUser("history-owner");
  const viewer = testUser("history-viewer");
  await createConfirmedUser(owner);
  await createConfirmedUser(viewer);

  await signIn(page, owner);
  await page.getByRole("link", { name: "Create a team workspace" }).click();
  await page.waitForURL(/\/new-workspace$/);
  const workspaceName = `History Check ${Date.now()}`;
  await page.getByLabel("Workspace name").fill(workspaceName);
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForURL(/\/dashboard$/);

  const workspaceId = page.url().match(/\/w\/([^/]+)\//)?.[1];
  expect(workspaceId).toBeTruthy();

  await page.getByRole("link", { name: "Expenses" }).click();
  await page.getByLabel("Amount").fill("12.00");
  await page.getByLabel("Date").fill(new Date().toISOString().slice(0, 10));
  await page.getByLabel("Merchant").fill("History Market");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("listitem").getByText("History Market")).toBeVisible();

  await page.getByRole("link", { name: "History" }).click();
  await page.waitForURL(/\/history$/);
  await expect(page.getByRole("heading", { name: "Activity history" })).toBeVisible();
  await expect(page.locator("section li").first()).toContainText("Expense added");

  await addViewer(workspaceId!, owner, viewer);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/sign-in$/);

  await signIn(page, viewer);
  await page.goto(`/en/w/${workspaceId}/history`);
  await expect(page.getByText("Only owners and admins can view activity history.")).toBeVisible();
  await expect(page.getByRole("link", { name: "History" })).toHaveCount(0);
});
