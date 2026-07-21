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
  const email = `reports-drilldown-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
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
  await expect(page).toHaveURL(/\/en\/w\/.+\/dashboard$/, { timeout: 30_000 });
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

test.describe("reports category drill-down", () => {
  test.skip(
    !supabaseUrl || !supabaseAnonKey,
    "Set Supabase URL and anon key values to run reports drill-down checks.",
  );

  test("category breakdown groups by main category and drills into subcategories", async ({ page }) => {
    const user = await signUp();
    const workspace = await apiFetch<{ id: string }>("/workspaces", user, {
      method: "POST",
      body: JSON.stringify({ name: "Reports Drilldown E2E" }),
    });
    const workspaceId = workspace.id;

    const transportationId = await categoryId(user, workspaceId, "expense", "Transportation");
    const publicTransitId = await categoryId(user, workspaceId, "expense", "Public Transit");
    const rideHailingId = await categoryId(user, workspaceId, "expense", "Ride-Hailing");

    const today = new Date().toISOString().slice(0, 10);
    for (const [categoryId, amountMinor] of [
      [publicTransitId, 4000],
      [publicTransitId, 6000],
      [rideHailingId, 3000],
      [transportationId, 8000],
    ] as const) {
      const response = await apiFetch(`/workspaces/${workspaceId}/expenses`, user, {
        method: "POST",
        body: JSON.stringify({ amount_minor: amountMinor, occurred_on: today, category_id: categoryId }),
      });
      void response;
    }

    await signIn(page, user);
    await page.goto(`/en/w/${workspaceId}/reports?period=custom&start=${today}&end=${today}`);
    await expect(page).toHaveURL(new RegExp(`/en/w/${workspaceId}/reports`));

    // Top-level breakdown groups by main category only — subcategory names
    // must not appear as their own top-level rows.
    const breakdownSection = page.locator("section").filter({ hasText: "Category breakdown" });
    await expect(breakdownSection.getByText("Transportation", { exact: true })).toBeVisible();
    await expect(breakdownSection.getByText("Public Transit", { exact: true })).toHaveCount(0);
    await expect(breakdownSection.getByText("Ride-Hailing", { exact: true })).toHaveCount(0);

    // Drill down: expect each subcategory total plus the explicit
    // "no subcategory" bucket for the directly-tagged expense.
    await breakdownSection.getByRole("button", { name: /Transportation/ }).click();
    await expect(breakdownSection.getByText("Public Transit", { exact: true })).toBeVisible();
    await expect(breakdownSection.getByText("Ride-Hailing", { exact: true })).toBeVisible();
    await expect(breakdownSection.getByText("No subcategory", { exact: true })).toBeVisible();

    // FR-006: system-provided category names in the reports breakdown must
    // localize too, not just on the category-management/record-entry
    // screens (regression the client-side join in `CategoryBreakdown`
    // fixes by resolving `category_id`/`subcategory_id` against the fetched
    // category tree's `translation_key`, instead of always rendering the
    // backend's English-only resolved name).
    await page.goto(`/ar/w/${workspaceId}/reports?period=custom&start=${today}&end=${today}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const arabicBreakdownSection = page.locator("section").filter({ hasText: "تفصيل التصنيفات" });
    await expect(arabicBreakdownSection.getByText("المواصلات", { exact: true })).toBeVisible();
    await expect(arabicBreakdownSection.getByText("Transportation", { exact: true })).toHaveCount(0);

    await arabicBreakdownSection.getByRole("button", { name: /المواصلات/ }).click();
    await expect(arabicBreakdownSection.getByText("النقل العام", { exact: true })).toBeVisible();
    await expect(arabicBreakdownSection.getByText("تطبيقات النقل", { exact: true })).toBeVisible();
    await expect(arabicBreakdownSection.getByText("بدون فئة فرعية", { exact: true })).toBeVisible();
  });
});
