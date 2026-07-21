import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

type TestUser = {
  email: string;
  password: string;
  token: string;
  userId: string;
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

// Matches quickstart.md's own local-stack verification technique (Section 5).
const DB_CONTAINER = "supabase_db_smart-expense-ai";

function decodeJwtSub(token: string): string {
  const payloadSegment = token.split(".")[1];
  const payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
  return payload.sub as string;
}

async function signUp(prefix: string): Promise<TestUser> {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const password = `Correct-${Date.now()}-A1`;
  const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: supabaseAnonKey!, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
  const payload = await response.json();
  const token = payload.access_token ?? payload.session?.access_token;
  expect(token).toBeTruthy();
  return { email, password, token, userId: decodeJwtSub(token) };
}

async function apiFetch<T = unknown>(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as T;
}

async function createWorkspace(owner: TestUser) {
  const workspace = await apiFetch<{ id: string }>("/workspaces", owner.token, {
    method: "POST",
    body: JSON.stringify({ name: `Category Suggestion E2E ${Date.now()}` }),
  });
  return workspace.id;
}

async function categoryId(owner: TestUser, workspaceId: string, name: string) {
  const { categories } = await apiFetch<{
    categories: { id: string; name: string; subcategories: { id: string; name: string }[] }[];
  }>(`/workspaces/${workspaceId}/categories?category_type=expense`, owner.token);
  for (const main of categories) {
    if (main.name === name) {
      return main.id;
    }
  }
  throw new Error(`Category ${name} not found`);
}

async function archiveCategory(owner: TestUser, workspaceId: string, categoryId: string) {
  await apiFetch(`/workspaces/${workspaceId}/categories/${categoryId}`, owner.token, {
    method: "PATCH",
    body: JSON.stringify({ is_archived: true }),
  });
}

/**
 * Next.js dev mode compiles each route on first hit; under a cold `npm run
 * dev` server that on-demand compile occasionally loses the race against
 * navigation and serves a transient 404. Retry the navigation rather than
 * the whole test.
 */
async function gotoReliably(page: Page, url: string, retries = 12): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    await page.goto(url);
    const is404 = await page
      .getByRole("heading", { name: "This page could not be found." })
      .isVisible()
      .catch(() => false);
    if (!is404) {
      return;
    }
    await page.waitForTimeout(2000);
  }
}

async function signIn(page: Page, user: TestUser) {
  await gotoReliably(page, "/en/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/w\/.+\/dashboard$/);
}

async function uploadFileAndGetId(page: Page, workspaceId: string, owner: TestUser, filename: string) {
  await gotoReliably(page, `/en/w/${workspaceId}/files`);
  await page.getByLabel("Upload receipt or invoice").setInputFiles({
    name: filename,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nreceipt\n"),
  });
  await page.getByRole("button", { name: "Upload file" }).click();
  await expect(page.getByText("File uploaded.")).toBeVisible();

  const files = (await apiFetch<{ files: { id: string; original_filename: string }[] }>(
    `/workspaces/${workspaceId}/files`,
    owner.token,
  )).files;
  const match = files.find((file) => file.original_filename === filename);
  expect(match).toBeTruthy();
  return match!.id;
}

function seedExtraction(params: {
  workspaceId: string;
  fileId: string;
  triggeredBy: string;
  amountMinor: number;
  occurredOn: string;
  suggestedCategoryId: string | null;
}): string {
  const suggestedCategoryIdValue = params.suggestedCategoryId ? `'${params.suggestedCategoryId}'` : "null";
  const sql = `
    insert into public.ai_extractions
      (workspace_id, file_id, provider, status, amount_minor, extracted_currency, occurred_on, vendor_name, suggested_category, suggested_category_id, triggered_by)
    values
      ('${params.workspaceId}', '${params.fileId}', 'openai', 'ready_for_review', ${params.amountMinor}, 'SAR', '${params.occurredOn}', 'Seeded Vendor', 'Groceries', ${suggestedCategoryIdValue}, '${params.triggeredBy}')
    returning id;
  `;
  // -q (quiet) suppresses the "INSERT 0 1" command-completion tag that
  // otherwise gets concatenated after the RETURNING value in script mode.
  return execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -tAq`, {
    input: sql,
    encoding: "utf8",
  }).trim();
}

test.describe("extraction category suggestion", () => {
  test.skip(
    !supabaseUrl || !supabaseAnonKey,
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to run extraction e2e checks.",
  );

  test("suggestion is pre-filled and editable, a disabled category is never pre-filled, and an override before confirm persists", async ({
    page,
  }) => {
    const owner = await signUp("extraction-suggestion-owner");
    const workspaceId = await createWorkspace(owner);
    const groceriesId = await categoryId(owner, workspaceId, "Groceries");
    const rentId = await categoryId(owner, workspaceId, "Rent");

    await signIn(page, owner);

    // --- suggestion pre-filled (quickstart.md Section 5, steps 1-2) ---
    const suggestedFileId = await uploadFileAndGetId(page, workspaceId, owner, "suggestion-prefilled.pdf");
    const suggestedExtractionId = seedExtraction({
      workspaceId,
      fileId: suggestedFileId,
      triggeredBy: owner.userId,
      amountMinor: 4250,
      occurredOn: "2026-07-01",
      suggestedCategoryId: groceriesId,
    });

    await gotoReliably(page, `/en/w/${workspaceId}/extractions/${suggestedExtractionId}`);
    await expect(page.getByRole("heading", { name: "Review extraction" })).toBeVisible();
    await expect(page.getByLabel("Category", { exact: true })).toHaveValue(groceriesId);

    // --- override before confirm persists the reviewer's final choice, not
    // the original suggestion (quickstart.md Section 5, steps 5-6) ---
    await page.getByLabel("Category", { exact: true }).selectOption({ label: "Rent" });
    await page.getByLabel("Date").fill("2026-07-05");
    const confirmResponse = page.waitForResponse((response) =>
      response.url().includes(`/extractions/${suggestedExtractionId}/confirm`),
    );
    await page.getByRole("button", { name: "Confirm extraction" }).click();
    await confirmResponse;

    const { expenses } = await apiFetch<{ expenses: { id: string; category_id: string | null }[] }>(
      `/workspaces/${workspaceId}/expenses`,
      owner.token,
    );
    const confirmedExpense = await apiFetch<{ expense_id: string }>(
      `/workspaces/${workspaceId}/extractions/${suggestedExtractionId}`,
      owner.token,
    );
    const persisted = expenses.find((expense) => expense.id === confirmedExpense.expense_id);
    expect(persisted?.category_id).toBe(rentId);

    // --- a disabled category is never offered as a suggestion, so a
    // suggestion resolved while disabled seeds suggested_category_id as null
    // (quickstart.md Section 5, steps 3-4) ---
    await archiveCategory(owner, workspaceId, groceriesId);
    const disabledFileId = await uploadFileAndGetId(page, workspaceId, owner, "suggestion-disabled.pdf");
    const disabledExtractionId = seedExtraction({
      workspaceId,
      fileId: disabledFileId,
      triggeredBy: owner.userId,
      amountMinor: 1500,
      occurredOn: "2026-07-02",
      suggestedCategoryId: null,
    });

    await gotoReliably(page, `/en/w/${workspaceId}/extractions/${disabledExtractionId}`);
    await expect(page.getByRole("heading", { name: "Review extraction" })).toBeVisible();
    await expect(page.getByLabel("Category", { exact: true })).toHaveValue("");
  });
});
