import { expect, test } from "@playwright/test";

import { createSeededUser, hasE2eEnvironment, seedWorkspace, signIn } from "./_helpers/matrix";

test.describe("mobile receipt capture", () => {
  test("MI-7 and MI-8: capture is mobile-only and the staged preview can be removed", async ({ page }, testInfo) => {
    test.skip(!hasE2eEnvironment, "Set local Supabase credentials to exercise receipt upload.");
    const user = await createSeededUser();
    const workspace = await seedWorkspace(user, "Capture workspace");
    if (testInfo.project.name !== "chromium") await page.addInitScript(() => Object.defineProperty(HTMLInputElement.prototype, "capture", { configurable: true, value: "" }));
    await signIn(page, "en", user);
    await page.goto(`/en/w/${workspace.id}/files`);
    const capture = page.getByLabel("Take a photo");
    if (testInfo.project.name === "chromium") await expect(capture).toHaveCount(0);
    else await expect(capture).toHaveAttribute("capture", "environment");
    await page.getByLabel("Upload receipt or invoice").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: Buffer.from("png") });
    await expect(page.getByText("receipt.png")).toBeVisible();
    await expect(page.getByText("1 KB")).toBeVisible();
    await page.getByRole("button", { name: "Remove photo" }).click();
    await expect(page.getByText("receipt.png")).toHaveCount(0);
  });

  test("MI-9: a failed upload followed by retry sends one successful upload", async ({ page }) => {
    test.skip(!hasE2eEnvironment, "Set local Supabase credentials to exercise receipt upload.");
    const user = await createSeededUser();
    const workspace = await seedWorkspace(user, "Capture retry workspace");
    await signIn(page, "en", user);
    await page.goto(`/en/w/${workspace.id}/files`);
    let attempts = 0;
    await page.route(`**/workspaces/${workspace.id}/files**`, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      attempts += 1;
      if (attempts === 1) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "temporary" } }) });
      else await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "one-file", original_filename: "retry.png", content_type: "image/png", size_bytes: 3, expense_id: null, uploaded_by: "user", status: "active", created_at: "2026-01-01T00:00:00Z" }) });
    });
    await page.getByLabel("Upload receipt or invoice").setInputFiles({ name: "retry.png", mimeType: "image/png", buffer: Buffer.from("png") });
    await page.getByRole("button", { name: "Upload file" }).click();
    await expect.poll(() => attempts).toBe(1);
    await expect(page.getByRole("button", { name: "Upload file" })).toBeEnabled();
    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(page.getByText("File uploaded.")).toBeVisible();
    expect(attempts).toBe(2);
  });
});
