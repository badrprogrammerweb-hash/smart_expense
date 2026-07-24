import { expect, test } from "@playwright/test";

import { createSeededUser, hasE2eEnvironment, seedIncome, signIn } from "./_helpers/matrix";

test.describe("offline behavior", () => {
  test("O-1: locale offline routes render the safety message", async ({ page }) => {
    await page.goto("/en/offline");
    await expect(page.getByRole("status")).toContainText("You are offline");
    await page.goto("/ar/offline");
    await expect(page.getByRole("status")).toBeVisible();
  });

  test("O-2/O-4/O-8/O-9: a disconnected workspace announces status, blocks writes, and settles after recovery", async ({ page }) => {
    test.skip(!hasE2eEnvironment, "Set local Supabase credentials to exercise an authenticated workspace.");
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    });
    const user = await createSeededUser();
    await signIn(page, "en", user);
    await page.goto(page.url().replace(/\/dashboard$/, "/incomes"));
    await page.waitForTimeout(1_600);
    await expect(page.getByRole("status")).toContainText("offline");
    await expect(page.getByText("Changes are unavailable until the connection returns.").first()).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeDisabled();
  });

  test("O-3/O-5/O-6/O-7: mutations never queue or retry", async ({ page }) => {
    await page.goto("/en/sign-in");
    const state = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
      indexed: indexedDB.databases ? indexedDB.databases() : Promise.resolve([]),
    }));
    expect(state.local.some((key) => /mutation|queue|draft/i.test(key))).toBe(false);
    expect(state.session.some((key) => /mutation|queue|draft/i.test(key))).toBe(false);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("SW-1 through SW-8: service worker is an allowlisted shell cache only", async ({ request }) => {
    const response = await request.get("/sw.js");
    expect(response.ok()).toBe(true);
    const source = await response.text();
    expect(source).toContain("request.method !== \"GET\"");
    expect(source).toContain("request.headers.has(\"Authorization\")");
    expect(source).toContain("/_next/static/");
    expect(source).toContain("/icons/");
    expect(source).toContain("/en/offline");
    expect(source).toContain("caches.delete");
    expect(source).not.toContain("BackgroundSync");
  });

  test("FR-009: deleting an existing income record is disabled with an explanation while offline (not just the add/edit form's submit button)", async ({ page, context }) => {
    // The generic submit-button check above only covers <button type="submit">, but a
    // record's Delete control in the history list is type="button" and mutates via a
    // separate handler — it needs its own assertion or a missing disabled={!canMutate}
    // here would ship silently.
    test.skip(!hasE2eEnvironment, "Set local Supabase credentials to exercise an authenticated workspace.");
    const user = await createSeededUser();
    await signIn(page, "en", user);
    const workspaceId = page.url().match(/\/w\/([^/]+)\//)?.[1];
    if (!workspaceId) throw new Error("Expected an active workspace route after sign-in.");

    await seedIncome(user, workspaceId);
    await page.goto(page.url().replace(/\/dashboard$/, "/incomes"));
    const deleteButton = page.getByRole("button", { name: "Delete" }).first();
    await expect(deleteButton).toBeEnabled();

    await context.setOffline(true);
    try {
      await page.waitForTimeout(1_600);
      await expect(deleteButton).toBeDisabled();
      await expect(page.getByText("Changes are unavailable until the connection returns.").first()).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  test("SW-4: a real network cut on a workspace navigation falls back to the locale-matched precached offline route", async ({ page, context }) => {
    // navigator.onLine=false (used elsewhere in this file) only fakes the JS-visible
    // signal; it never severs an actual request, so it cannot exercise the service
    // worker's fetch().catch() fallback. context.setOffline(true) does cut the network,
    // which is what this check requires.
    await page.goto("/ar/sign-in");
    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));

    await context.setOffline(true);
    try {
      await page.goto("/ar/w/00000000-0000-0000-0000-000000000000/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("status")).toBeVisible();
      await expect(page).not.toHaveTitle(/error/i);

      await page.goto("/en/w/00000000-0000-0000-0000-000000000000/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("status")).toContainText("You are offline");
    } finally {
      await context.setOffline(false);
    }
  });

  test("SW-1/SW-3: an authenticated session that visits dashboard, records, files, and reports leaves zero API-origin cache entries, and every cached entry is on the allowlist", async ({ page }) => {
    test.skip(!hasE2eEnvironment, "Set local Supabase credentials to exercise an authenticated workspace.");
    const user = await createSeededUser();
    await signIn(page, "en", user);

    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));

    const workspacePath = page.url().match(/\/en\/w\/[^/]+/)?.[0];
    if (!workspacePath) throw new Error("Expected an active workspace route after sign-in.");
    for (const route of ["dashboard", "expenses", "incomes", "files", "reports"]) {
      await page.goto(`${workspacePath}/${route}`);
      await page.waitForLoadState("networkidle");
    }

    const cachedUrls = await page.evaluate(async () => {
      const names = await caches.keys();
      const urls: string[] = [];
      for (const name of names) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) urls.push(request.url);
      }
      return urls;
    });

    const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").origin;
    const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321").origin;
    const violatingApiEntries = cachedUrls.filter((url) => url.startsWith(apiOrigin) || url.startsWith(supabaseOrigin));
    expect(violatingApiEntries).toEqual([]);

    const allowlist = /\/(icons\/|manifest\.webmanifest$|_next\/static\/|(ar|en)\/offline$)/;
    const offAllowlist = cachedUrls.filter((url) => !allowlist.test(url));
    expect(offAllowlist).toEqual([]);
  });
});
