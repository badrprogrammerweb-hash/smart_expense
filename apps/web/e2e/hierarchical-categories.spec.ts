import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type TestUser = {
  email: string;
  password: string;
  userId: string;
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
loadEnvFile(resolve(process.cwd(), "..", "api", ".env"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

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

async function signUp(): Promise<TestUser> {
  const email = `hier-cat-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
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
  const userId = payload.user?.id;
  if (!accessToken || !userId) {
    throw new Error(`Signup did not return a session: ${JSON.stringify(payload)}`);
  }
  return { email, password, userId, accessToken };
}

async function signIn(page: Page, user: TestUser) {
  await page.goto("/en/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function categoryId(
  user: TestUser,
  workspaceId: string,
  categoryType: "income" | "expense",
  name: string,
) {
  const { categories } = await apiFetch<{
    categories: { id: string; name: string; subcategories: { id: string; name: string }[] }[];
  }>(`/workspaces/${workspaceId}/categories?category_type=${categoryType}`, user);
  for (const main of categories) {
    if (main.name === name) {
      return main.id;
    }
    const sub = main.subcategories.find((item) => item.name === name);
    if (sub) {
      return sub.id;
    }
  }
  throw new Error(`Category ${name} not found`);
}

test.describe("hierarchical categories", () => {
  test.skip(
    !supabaseUrl || !supabaseAnonKey,
    "Set Supabase URL and anon key values to run hierarchical category checks.",
  );

  test("expense and income records support main category and subcategory selection", async ({ page }) => {
    const user = await signUp();
    const workspace = await apiFetch<{ id: string }>("/workspaces", user, {
      method: "POST",
      body: JSON.stringify({ name: "Hierarchical Categories E2E" }),
    });
    const workspaceId = workspace.id;

    await signIn(page, user);
    await expect(page).toHaveURL(/\/en\/w\/.+\/dashboard$/, { timeout: 30_000 });
    await page.goto(`/en/w/${workspaceId}/expenses`);
    await expect(page).toHaveURL(new RegExp(`/en/w/${workspaceId}/expenses$`));

    // Expense with main category + subcategory. Each row is located by its
    // unique `occurred_on` date text rather than a bare page-wide text
    // search, since the always-visible "add new" form's (closed) Category
    // <select> also contains every main category name as a hidden <option>.
    await page.getByLabel("Amount").fill("45.00");
    await page.getByLabel("Date").fill("2026-07-10");
    await page.getByLabel("Category", { exact: true }).selectOption({ label: "Transportation" });
    await page.getByLabel("Subcategory").selectOption({ label: "Vehicle Maintenance" });
    await page.getByRole("button", { name: "Save" }).click();
    const vehicleMaintenanceRow = page.locator("li").filter({ hasText: "2026-07-10" });
    await expect(vehicleMaintenanceRow.getByText("Vehicle Maintenance").first()).toBeVisible();

    // Expense with only a main category (no subcategory).
    await page.getByLabel("Amount").fill("120.00");
    await page.getByLabel("Date").fill("2026-07-11");
    await page.getByLabel("Category", { exact: true }).selectOption({ label: "Rent" });
    await page.getByRole("button", { name: "Save" }).click();
    const rentRow = page.locator("li").filter({ hasText: "2026-07-11" });
    await expect(rentRow.getByText("Rent").first()).toBeVisible();

    // Edit the first expense: changing the main category clears the stale
    // subcategory selection (spec Acceptance Scenario 5). Once editing
    // starts, the row's date text is no longer rendered (it moves into an
    // <input type="date"> value, not text content), so the edit form is
    // instead scoped by its unique "Update expense" heading — the
    // always-visible "add new" form above it has its own Category/
    // Subcategory/Save controls on the same page.
    await vehicleMaintenanceRow.getByRole("button", { name: "Edit" }).click();
    const editForm = page.locator("form", { has: page.getByRole("heading", { name: "Update expense" }) });
    await editForm.getByLabel("Category", { exact: true }).selectOption({ label: "Utilities" });
    await expect(editForm.getByLabel("Subcategory")).toHaveValue("");
    await editForm.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("li").filter({ hasText: "2026-07-10" }).getByText("Utilities").first()).toBeVisible();
    await expect(page.getByText("Vehicle Maintenance")).toHaveCount(0);

    // Income with main category + subcategory.
    await page.goto(`/en/w/${workspaceId}/incomes`);
    await page.getByLabel("Amount").fill("5000.00");
    await page.getByLabel("Date").fill("2026-07-01");
    await page.getByLabel("Category", { exact: true }).selectOption({ label: "Salary" });
    await page.getByLabel("Subcategory").selectOption({ label: "Bonus & Commission" });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("li").filter({ hasText: "2026-07-01" })).toBeVisible();

    const { incomes } = await apiFetch<{ incomes: { category_id: string | null }[] }>(
      `/workspaces/${workspaceId}/incomes`,
      user,
    );
    const bonusId = await categoryId(user, workspaceId, "income", "Bonus & Commission");
    expect(incomes.some((income) => income.category_id === bonusId)).toBe(true);
  });
});
