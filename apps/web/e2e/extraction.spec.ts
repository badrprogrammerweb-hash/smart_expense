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

// Same fixed fake key used throughout the pytest suite. Configuring BYOK
// with it and actually triggering makes one genuine outbound call to the
// real provider -- deterministically rejected (401 -> invalid_key) since
// the key isn't a real credential, which is itself a valid, safely-handled
// terminal outcome (FR-019). Confirming a *successful* extraction therefore
// needs a `ready_for_review` row seeded directly (below), the same technique
// `test_extraction_totals.py` uses at the pytest layer to reach states an
// external provider can't be made to produce deterministically in tests.
const openAiKey = "sk-test-0000000000000000abcd";

// Matches quickstart.md's own local-stack verification technique (Scenario 2).
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

async function createWorkspace(owner: TestUser) {
  const response = await apiFetch("/workspaces", owner.token, {
    method: "POST",
    body: JSON.stringify({ name: `Extraction E2E ${Date.now()}` }),
  });
  const workspace = await response.json();
  return workspace.id as string;
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

  const filesResponse = await apiFetch(`/workspaces/${workspaceId}/files`, owner.token);
  const files = (await filesResponse.json()).files as { id: string; original_filename: string }[];
  const match = files.find((file) => file.original_filename === filename);
  expect(match).toBeTruthy();
  return match!.id;
}

function seedReadyForReviewExtraction(params: {
  workspaceId: string;
  fileId: string;
  triggeredBy: string;
  amountMinor: number;
  occurredOn: string;
}): string {
  const sql = `
    insert into public.ai_extractions
      (workspace_id, file_id, provider, status, amount_minor, extracted_currency, occurred_on, vendor_name, suggested_category, triggered_by)
    values
      ('${params.workspaceId}', '${params.fileId}', 'openai', 'ready_for_review', ${params.amountMinor}, 'SAR', '${params.occurredOn}', 'Seeded Vendor', 'Groceries', '${params.triggeredBy}')
    returning id;
  `;
  // -q (quiet) suppresses the "INSERT 0 1" command-completion tag that
  // otherwise gets concatenated after the RETURNING value in script mode.
  return execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -tAq`, {
    input: sql,
    encoding: "utf8",
  }).trim();
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

async function configureAiSettings(page: Page, workspaceId: string) {
  await gotoReliably(page, `/en/w/${workspaceId}/settings`);
  await page.getByLabel("Provider").selectOption("openai");
  await page.getByLabel("API key").fill(openAiKey);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Configured", { exact: true })).toBeVisible();
}

test.describe("extraction", () => {
  test.skip(
    !supabaseUrl || !supabaseAnonKey,
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to run extraction e2e checks.",
  );

  test("trigger produces a safe classified failure and can be discarded; a seeded ready_for_review extraction can be reviewed and confirmed", async ({
    page,
  }) => {
    const owner = await signUp("extraction-owner");
    const workspaceId = await createWorkspace(owner);

    const responseBodies: Promise<string>[] = [];
    page.on("response", (response) => {
      if (response.url().includes(`/workspaces/${workspaceId}/`)) {
        responseBodies.push(response.text().catch(() => ""));
      }
    });

    await signIn(page, owner);
    await configureAiSettings(page, workspaceId);

    // --- trigger -> discard path (a real, deterministic terminal outcome:
    // the fake key is genuinely rejected by the provider) ---
    await uploadFileAndGetId(page, workspaceId, owner, "extraction-discard.pdf");
    await gotoReliably(page, `/en/w/${workspaceId}/files`);
    const triggerResponse = page.waitForResponse(
      (response) => response.url().includes("/extractions") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Extract with AI" }).click();
    await triggerResponse;
    // The fake key is genuinely rejected by the real provider (401), so the
    // button shows the classified, translated reason -- never raw provider
    // text (FR-019).
    await expect(page.getByText("The configured AI key was rejected by the provider.")).toBeVisible();

    await gotoReliably(page, `/en/w/${workspaceId}/extractions`);
    await expect(page.getByRole("heading", { name: "Pending review" })).toBeVisible();
    await page.getByRole("button", { name: "Discard extraction" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("No extractions waiting for review.")).toBeVisible();

    // --- trigger -> review -> confirm happy path (seeded ready_for_review,
    // since a real provider call cannot be made to succeed deterministically
    // without a live paid key) ---
    const confirmFileId = await uploadFileAndGetId(page, workspaceId, owner, "extraction-confirm.pdf");
    const extractionId = seedReadyForReviewExtraction({
      workspaceId,
      fileId: confirmFileId,
      triggeredBy: owner.userId,
      amountMinor: 4250,
      occurredOn: "2026-07-01",
    });

    await gotoReliably(page, `/en/w/${workspaceId}/extractions/${extractionId}`);
    await expect(page.getByRole("heading", { name: "Review extraction" })).toBeVisible();
    await expect(page.getByLabel("Amount")).toHaveValue("42.50");

    await page.getByLabel("Amount").fill("99.00");
    await page.getByLabel("Date").fill("2026-07-05");
    const confirmResponse = page.waitForResponse(
      (response) => response.url().includes(`/extractions/${extractionId}/confirm`),
    );
    await page.getByRole("button", { name: "Confirm extraction" }).click();
    const confirmBody = await (await confirmResponse).text();
    expect(confirmBody).not.toContain(openAiKey);
    expect(JSON.parse(confirmBody).status).toBe("confirmed");

    // Post-confirm, can_edit flips false (status is no longer ready_for_review),
    // so the review screen re-renders read-only and the confirm control is
    // gone. (It shows the AI's original draft amount, "42.50" -- confirm
    // never rewrites ai_extractions.amount_minor, only the new expense row
    // carries the corrected "99.00".)
    await expect(page.getByRole("button", { name: "Confirm extraction" })).not.toBeVisible();
    await expect(page.getByText("42.50")).toBeVisible();

    // --- key-secrecy: not one captured response, across the whole flow,
    // ever contained the configured key ---
    const bodies = await Promise.all(responseBodies);
    for (const body of bodies) {
      expect(body).not.toContain(openAiKey);
    }
  });

  test("Arabic extraction surfaces render right-to-left", async ({ page }) => {
    const owner = await signUp("extraction-rtl-owner");
    const workspaceId = await createWorkspace(owner);
    await signIn(page, owner);
    await configureAiSettings(page, workspaceId);

    const fileId = await uploadFileAndGetId(page, workspaceId, owner, "extraction-rtl.pdf");
    const extractionId = seedReadyForReviewExtraction({
      workspaceId,
      fileId,
      triggeredBy: owner.userId,
      amountMinor: 1000,
      occurredOn: "2026-07-01",
    });

    await gotoReliably(page, `/ar/w/${workspaceId}/extractions`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "بانتظار المراجعة" })).toBeVisible();
    await expect(page.getByText("جاهز للمراجعة")).toBeVisible();

    await gotoReliably(page, `/ar/w/${workspaceId}/extractions/${extractionId}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "مراجعة الاستخراج" })).toBeVisible();
    await expect(page.getByText("المبلغ")).toBeVisible();

    await page.getByRole("button", { name: "تجاهل الاستخراج" }).click();
    await expect(page.getByText("تأكيد التجاهل")).toBeVisible();
    await expect(page.getByText("لن يتم إنشاء مصروف، وسيبقى الملف متاحًا.")).toBeVisible();
  });
});
