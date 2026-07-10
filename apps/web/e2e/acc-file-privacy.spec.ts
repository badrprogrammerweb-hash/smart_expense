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

async function createWorkspace(owner: TestUser) {
  const response = await apiFetch("/workspaces", owner.token, {
    method: "POST",
    body: JSON.stringify({ name: `File Privacy Acceptance ${Date.now()}` }),
  });
  return (await response.json()).id as string;
}

async function signIn(page: Page, user: TestUser) {
  await page.goto("/en/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/w\/.+\/dashboard$/);
}

test.describe("acceptance file privacy", () => {
  test.skip(
    !supabaseUrl || !supabaseAnonKey,
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to run file privacy acceptance checks.",
  );

  test("financial documents surface metadata and signed links, never a public URL", async ({
    context,
    page,
  }) => {
    test.setTimeout(120_000);
    const owner = await signUp("acc-file-private-owner");
    const workspaceId = await createWorkspace(owner);
    const metadataBodies: Promise<string>[] = [];

    page.on("response", (response) => {
      const url = response.url();
      if (
        url.includes(`/workspaces/${workspaceId}/files`) &&
        !url.includes("/download-url")
      ) {
        metadataBodies.push(response.text().catch(() => ""));
      }
    });

    await signIn(page, owner);
    await page.goto(`/en/w/${workspaceId}/files`);
    await expect(page.getByRole("heading", { name: "Files", exact: true })).toBeVisible();

    const filename = `private-financial-document-${Date.now()}.pdf`;
    await page.getByLabel("Upload receipt or invoice").setInputFiles({
      name: filename,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\nprivate financial document\n"),
    });
    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(page.getByText("File uploaded.")).toBeVisible();

    const row = page.getByRole("row", { name: new RegExp(filename) });
    await expect(row).toBeVisible();
    await expect(
      page.locator(
        'a[href*="/storage/v1/object/public/"], [src*="/storage/v1/object/public/"]',
      ),
    ).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toContain("/storage/v1/object/public/");

    const popupPromise = context.waitForEvent("page");
    const signedResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/workspaces/${workspaceId}/files/`) &&
        response.url().includes("/download-url") &&
        response.status() === 200,
    );
    await row.getByRole("button", { name: `Preview ${filename}` }).click();
    const signedResponse = await signedResponsePromise;
    const signedPayload = await signedResponse.json();
    expect(signedPayload.url).toContain("/storage/v1/object/sign/receipts/");
    expect(signedPayload.url).not.toContain("/storage/v1/object/public/");
    expect(signedPayload.expires_in).toBeLessThanOrEqual(300);

    const popup = await popupPromise;
    await popup.close();

    const bodies = await Promise.all(metadataBodies);
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body).not.toContain("storage_path");
      expect(body).not.toContain("public_url");
      expect(body).not.toContain("/storage/v1/object/public/");
    }
  });
});
