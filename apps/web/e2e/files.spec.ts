import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

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

async function createWorkspace(owner: TestUser, viewer: TestUser) {
  const workspaceResponse = await apiFetch("/workspaces", owner.token, {
    method: "POST",
    body: JSON.stringify({ name: `Files E2E ${Date.now()}` }),
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

async function uploadPdf(page: Page, filename: string) {
  await page.getByLabel("Upload receipt or invoice").setInputFiles({
    name: filename,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nreceipt\n"),
  });
  await page.getByRole("button", { name: "Upload file" }).click();
  await expect(page.getByText("File uploaded.")).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(filename) })).toBeVisible();
}

test.describe("files", () => {
  test.skip(
    !supabaseUrl || !supabaseAnonKey,
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to run file e2e checks.",
  );

  test("owner can upload, preview, and delete; viewer sees no upload or delete controls", async ({
    context,
    page,
  }) => {
    const owner = await signUp("files-owner");
    const viewer = await signUp("files-viewer");
    const workspaceId = await createWorkspace(owner, viewer);

    await signIn(page, owner);
    await page.goto(`/en/w/${workspaceId}/files`);
    await expect(page.getByRole("heading", { name: "Files", exact: true })).toBeVisible();

    const deletedFilename = `receipt-${Date.now()}.pdf`;
    await uploadPdf(page, deletedFilename);

    const row = page.getByRole("row", { name: new RegExp(deletedFilename) });
    const popupPromise = context.waitForEvent("page");
    const signedUrlPromise = page.waitForResponse(
      (response) => response.url().includes("/download-url") && response.status() === 200,
    );
    await row.getByRole("button", { name: `Preview ${deletedFilename}` }).click();
    const signedUrlResponse = await signedUrlPromise;
    const signedUrl = await signedUrlResponse.json();
    expect(signedUrl.url).toContain("/storage/v1/object/sign/receipts/");
    const popup = await popupPromise;
    await popup.close();

    await row.getByRole("button", { name: "Delete file" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText(deletedFilename)).toHaveCount(0);

    const viewerFilename = `viewer-visible-${Date.now()}.pdf`;
    await uploadPdf(page, viewerFilename);

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/en\/sign-in$/);

    await signIn(page, viewer);
    await page.goto(`/en/w/${workspaceId}/files`);
    await expect(page.getByLabel("Files").getByText(viewerFilename)).toBeVisible();
    await expect(page.getByLabel("Upload receipt or invoice")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete file" })).toHaveCount(0);
  });

  test("Arabic files and settings surfaces render right-to-left", async ({ page }) => {
    const owner = await signUp("files-rtl-owner");
    const viewer = await signUp("files-rtl-viewer");
    const workspaceId = await createWorkspace(owner, viewer);

    await signIn(page, owner);

    await page.goto(`/ar/w/${workspaceId}/files`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "الملفات", exact: true })).toBeVisible();
    await expect(page.getByLabel("رفع إيصال أو فاتورة")).toBeVisible();
    await expect(page.getByRole("button", { name: "رفع ملف" })).toBeVisible();

    await page.goto(`/ar/w/${workspaceId}/settings`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "الإعدادات" })).toBeVisible();
    await expect(page.getByLabel("الحذف التلقائي بعد الاستخراج")).toBeVisible();
  });
});
