import { expect, test, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
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
const DB_CONTAINER = "supabase_db_smart-expense-ai";

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
  const email = `currency-format-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
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

async function signIn(page: Page, user: TestUser, locale: "en" | "ar") {
  await page.goto(`/${locale}/sign-in`);
  await page.getByLabel(locale === "ar" ? "البريد الإلكتروني" : "Email").fill(user.email);
  await page.getByLabel(locale === "ar" ? "كلمة المرور" : "Password").fill(user.password);
  await page.getByRole("button", { name: locale === "ar" ? "تسجيل الدخول" : "Sign in" }).click();
}

function seedReadyExtraction(user: TestUser, workspaceId: string, amountMinor: number) {
  const occurredOn = new Date().toISOString().slice(0, 10);
  const sql = `
    with inserted_file as (
      insert into public.files (
        workspace_id, uploaded_by, original_filename, content_type, size_bytes, storage_path
      )
      values (
        '${workspaceId}', '${user.userId}', 'currency-review.pdf', 'application/pdf', 128,
        '${workspaceId}/currency-review.pdf'
      )
      returning id
    )
    insert into public.ai_extractions (
      workspace_id, file_id, provider, status, amount_minor, extracted_currency,
      occurred_on, vendor_name, suggested_category, triggered_by
    )
    select
      '${workspaceId}', id, 'openai', 'ready_for_review', ${amountMinor}, 'SAR',
      '${occurredOn}', 'Review Merchant', 'Groceries', '${user.userId}'
    from inserted_file
    returning id;
  `;

  return execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -tAq`, {
    input: sql,
    encoding: "utf8",
  }).trim();
}

test.describe("workspace currency formatting", () => {
  test.skip(
    !supabaseUrl || !supabaseAnonKey,
    "Set Supabase URL and anon key values to run workspace currency formatting checks.",
  );

  test("shows KWD formatting across financial surfaces in English and Arabic", async ({ page }) => {
    const user = await signUp();
    const workspace = await apiFetch<{ id: string }>(
      "/workspaces",
      user,
      {
        method: "POST",
        body: JSON.stringify({ name: "KWD Formatting" }),
      },
    );
    const workspaceId = workspace.id;

    await apiFetch(`/workspaces/${workspaceId}`, user, {
      method: "PATCH",
      body: JSON.stringify({ currency: "KWD" }),
    });
    await apiFetch(`/workspaces/${workspaceId}/incomes`, user, {
      method: "POST",
      body: JSON.stringify({
        amount_minor: 12345,
        occurred_on: new Date().toISOString().slice(0, 10),
        description: "KWD Salary",
      }),
    });
    await apiFetch(`/workspaces/${workspaceId}/expenses`, user, {
      method: "POST",
      body: JSON.stringify({
        amount_minor: 1234,
        occurred_on: new Date().toISOString().slice(0, 10),
        description: "KWD Lunch",
        merchant_name: "KWD Cafe",
      }),
    });
    const extractionId = seedReadyExtraction(user, workspaceId, 4250);

    await signIn(page, user, "en");
    await expect(page).toHaveURL(/\/en\/w\/.+\/dashboard$/, { timeout: 30_000 });
    await page.goto(`/en/w/${workspaceId}/dashboard`);
    await expect(page).toHaveURL(new RegExp(`/en/w/${workspaceId}/dashboard$`));
    await expect(page.getByText(/KWD\s*12\.345/).first()).toBeVisible();
    await expect(page.getByText(/KWD\s*1\.234/).first()).toBeVisible();

    await page.getByRole("link", { name: "Incomes" }).click();
    await page.waitForURL(/\/incomes$/);
    await expect(page.getByText(/KWD\s*12\.345/).first()).toBeVisible();

    await page.getByRole("link", { name: "Expenses" }).click();
    await page.waitForURL(/\/expenses$/);
    await expect(page.getByText(/KWD\s*1\.234/).first()).toBeVisible();

    await page.getByRole("link", { name: "Reports" }).click();
    await page.waitForURL(/\/reports$/);
    await expect(page.getByText(/KWD\s*11\.111/).first()).toBeVisible();

    await page.goto(`/en/w/${workspaceId}/extractions/${extractionId}`);
    await expect(page.getByText("KWD").first()).toBeVisible();
    await expect(page.getByLabel("Amount")).toHaveValue("4.250");

    await page.getByRole("link", { name: "History" }).click();
    await page.waitForURL(/\/history$/);
    await expect(page.getByText(/KWD\s*1\.234/).first()).toBeVisible();

    await page.goto(`/ar/w/${workspaceId}/dashboard`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText(/KWD|د\.ك|دينار/).first()).toBeVisible();
  });
});
