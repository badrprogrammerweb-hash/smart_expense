import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

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

async function createWorkspace(users: Record<WorkspaceRole, TestUser>) {
  const workspaceResponse = await apiFetch("/workspaces", users.owner.token, {
    method: "POST",
    body: JSON.stringify({ name: `Role Acceptance ${Date.now()}` }),
  });
  const workspace = await workspaceResponse.json();

  for (const role of ["admin", "member", "viewer"] as const) {
    await apiFetch(`/workspaces/${workspace.id}/members`, users.owner.token, {
      method: "POST",
      body: JSON.stringify({ email: users[role].email, role }),
    });
  }

  return workspace.id as string;
}

async function signIn(page: Page, user: TestUser) {
  await page.goto("/en/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/w\/.+\/dashboard$/);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/en\/sign-in$/);
}

async function expectNavigation(page: Page, workspaceId: string, role: WorkspaceRole) {
  await page.goto(`/en/w/${workspaceId}/dashboard`);
  await expect(page.getByText(`${role} role`, { exact: true })).toBeVisible();

  const incomeVisible = role === "owner" || role === "admin";
  const expenseVisible = role !== "viewer";
  const historyVisible = role === "owner" || role === "admin";

  await expect(page.getByRole("link", { name: "Incomes", exact: true })).toHaveCount(
    incomeVisible ? 1 : 0,
  );
  await expect(page.getByRole("link", { name: "Expenses", exact: true })).toHaveCount(
    expenseVisible ? 1 : 0,
  );
  await expect(page.getByRole("link", { name: "History", exact: true })).toHaveCount(
    historyVisible ? 1 : 0,
  );

  for (const name of ["Files", "AI reviews", "Categories", "Reports", "Settings"]) {
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  }
}

async function expectDirectRouteControls(
  page: Page,
  workspaceId: string,
  role: WorkspaceRole,
) {
  const managesIncome = role === "owner" || role === "admin";
  const createsExpense = role !== "viewer";
  const managesCategories = role === "owner" || role === "admin";
  const uploadsFiles = role !== "viewer";
  const viewsHistory = role === "owner" || role === "admin";

  await page.goto(`/en/w/${workspaceId}/incomes`);
  await expect(page.getByRole("heading", { name: "Add income" })).toHaveCount(
    managesIncome ? 1 : 0,
  );
  if (!managesIncome) {
    await expect(page.getByText("Only owners and admins can manage income.")).toBeVisible();
  }

  await page.goto(`/en/w/${workspaceId}/expenses`);
  await expect(page.getByRole("heading", { name: "Add expense" })).toHaveCount(
    createsExpense ? 1 : 0,
  );
  if (!createsExpense) {
    await expect(
      page.getByText("Your current role can view this workspace but cannot modify records."),
    ).toBeVisible();
  }

  await page.goto(`/en/w/${workspaceId}/categories`);
  await expect(page.getByRole("heading", { name: "Add category" })).toHaveCount(
    managesCategories ? 1 : 0,
  );
  if (!managesCategories) {
    await expect(
      page.getByText("Your current role can view categories but cannot manage them."),
    ).toBeVisible();
  }

  await page.goto(`/en/w/${workspaceId}/files`);
  await expect(page.getByLabel("Upload receipt or invoice")).toHaveCount(uploadsFiles ? 1 : 0);

  await page.goto(`/en/w/${workspaceId}/settings`);
  const autoDelete = page.getByLabel("Auto-delete after extraction");
  await expect(autoDelete).toBeVisible();
  if (role === "owner") {
    await expect(autoDelete).toBeEnabled();
    await expect(page.getByLabel("Provider")).toBeVisible();
  } else {
    await expect(autoDelete).toBeDisabled();
    await expect(page.getByLabel("Provider")).toHaveCount(0);
    await expect(page.getByLabel("API key")).toHaveCount(0);
  }

  await page.goto(`/en/w/${workspaceId}/history`);
  if (viewsHistory) {
    await expect(page.getByRole("heading", { name: "Activity history" })).toBeVisible();
  } else {
    await expect(
      page.getByText("Only owners and admins can view activity history."),
    ).toBeVisible();
  }
}

test.describe("acceptance role permissions", () => {
  test.skip(
    !supabaseUrl || !supabaseAnonKey,
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to run role acceptance checks.",
  );

  test("role-gated surfaces match the backend matrix and Viewer stays read-only", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const users: Record<WorkspaceRole, TestUser> = {
      owner: await signUp("acc-role-owner"),
      admin: await signUp("acc-role-admin"),
      member: await signUp("acc-role-member"),
      viewer: await signUp("acc-role-viewer"),
    };
    const workspaceId = await createWorkspace(users);

    for (const role of ["owner", "admin", "member", "viewer"] as const) {
      await signIn(page, users[role]);
      await expectNavigation(page, workspaceId, role);
      await expectDirectRouteControls(page, workspaceId, role);
      await signOut(page);
    }
  });
});
