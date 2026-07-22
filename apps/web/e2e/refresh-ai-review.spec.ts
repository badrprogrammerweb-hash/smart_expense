import { execSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { createSeededUser, hasE2eEnvironment, seedWorkspace, signIn } from "./_helpers/matrix";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const dbContainer = "supabase_db_smart-expense-ai";
const testKey = "sk-test-0000000000000000abcd";

function userId(accessToken: string) {
  return JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8")).sub as string;
}

async function apiFetch(path: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) throw new Error(await response.text());
  return response;
}

function seedReadyForReviewExtraction(workspaceId: string, fileId: string, triggeredBy: string) {
  const sql = `insert into public.ai_extractions (workspace_id, file_id, provider, status, amount_minor, extracted_currency, occurred_on, vendor_name, suggested_category, triggered_by) values ('${workspaceId}', '${fileId}', 'openai', 'ready_for_review', 4250, 'SAR', '2026-07-01', 'Seeded Vendor', 'Groceries', '${triggeredBy}') returning id;`;
  return execSync(`docker exec -i ${dbContainer} psql -U postgres -d postgres -tAq`, { input: sql, encoding: "utf8" }).trim();
}

test.describe("design refresh AI review", () => {
  test.skip(!hasE2eEnvironment, "Set local Supabase credentials to run AI review checks.");

  test("distinguishes pending AI drafts, masks keys, and creates an expense only after confirmation", async ({ page }) => {
    const owner = await createSeededUser();
    const workspace = await seedWorkspace(owner, "Refresh AI review");
    await signIn(page, "en", owner);

    await page.goto(`/en/w/${workspace.id}/files`);
    await page.getByLabel("Upload receipt or invoice").setInputFiles({ name: "refresh-ai-review.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nreview") });
    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(page.getByText("File uploaded.")).toBeVisible();
    const files = await (await apiFetch(`/workspaces/${workspace.id}/files`, owner.accessToken)).json() as { files: { id: string; original_filename: string }[] };
    const file = files.files.find((record) => record.original_filename === "refresh-ai-review.pdf");
    expect(file).toBeTruthy();
    const extractionId = seedReadyForReviewExtraction(workspace.id, file!.id, userId(owner.accessToken));

    await page.goto(`/en/w/${workspace.id}/extractions`);
    const pending = page.locator("[data-status='pending']:visible", { hasText: "Ready for review" });
    await expect(pending).toBeVisible();
    const pendingClass = await pending.getAttribute("class");

    await page.goto(`/en/w/${workspace.id}/settings`);
    await page.getByLabel("Provider").selectOption("openai");
    await page.getByLabel("API key").fill(testKey);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("****abcd", { exact: true })).toBeVisible();
    await expect(page.getByText(testKey, { exact: false })).toHaveCount(0);

    await page.goto(`/en/w/${workspace.id}/extractions/${extractionId}`);
    await expect(page.getByText("These are draft values. They will not affect your balance or reports until you confirm them.")).toBeVisible();
    const confirmResponse = page.waitForResponse((response) => response.url().includes(`/extractions/${extractionId}/confirm`) && response.request().method() === "POST");
    await page.getByRole("button", { name: "Confirm extraction" }).click();
    const confirmed = await (await confirmResponse).json() as { status: string; expense_id: string | null };
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.expense_id).toBeTruthy();
    const confirmedBadge = page.locator("[data-status='confirmed']", { hasText: "Confirmed" });
    await expect(confirmedBadge).toBeVisible();
    expect(await confirmedBadge.getAttribute("class")).not.toBe(pendingClass);

    const expenses = await (await apiFetch(`/workspaces/${workspace.id}/expenses`, owner.accessToken)).json() as { expenses: { id: string }[] };
    expect(expenses.expenses.some((expense) => expense.id === confirmed.expense_id)).toBe(true);
  });
});
