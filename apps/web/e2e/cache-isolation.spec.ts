import { expect, test } from "@playwright/test";

import { createSeededUser, hasE2eEnvironment, seedIncome, seedWorkspace, signIn } from "./_helpers/matrix";

test.describe("cache isolation", () => {
  test("O-10a: switching workspace never shows the prior workspace's records under the new one", async ({ page }) => {
    // The in-memory eviction predicate itself (removeQueries scoped to the previous
    // workspaceId) is verified deterministically in lib/__tests__/workspace-context.test.ts.
    // This proves the user-visible outcome that predicate exists to guarantee.
    test.skip(!hasE2eEnvironment, "Set local Supabase credentials to exercise workspace isolation.");
    const user = await createSeededUser();
    const first = await seedWorkspace(user, "Isolation A");
    const second = await seedWorkspace(user, "Isolation B");
    await seedIncome(user, first.id);
    await signIn(page, "en", user);
    await page.goto(`/en/w/${first.id}/incomes`);
    await expect(page.getByText("RTL regression income")).toHaveCount(2);

    await page.locator("#workspace-switcher").selectOption(second.id);
    await page.waitForURL(new RegExp(`/en/w/${second.id}/dashboard$`));
    await page.goto(`/en/w/${second.id}/incomes`);
    await expect(page.getByText("RTL regression income")).toHaveCount(0);
  });

  test("O-10b: a workspace switch immediately followed by going offline still renders safely (no stale data surfaced, no broken page)", async ({ page, context }) => {
    // A full-page navigation while offline is served by the service worker's
    // network-first-with-offline-fallback route (verified in offline-behavior.spec.ts's
    // SW-4 test) regardless of what is or isn't evicted from the query cache — so this
    // does not (and cannot) stand in for O-10a above. What it does verify: the switch
    // does not leave the app in a state where going offline right after somehow exposes
    // workspace A's data instead of the expected offline/empty state.
    test.skip(!hasE2eEnvironment, "Set local Supabase credentials to exercise workspace isolation.");
    const user = await createSeededUser();
    const first = await seedWorkspace(user, "Isolation A");
    const second = await seedWorkspace(user, "Isolation B");
    await seedIncome(user, first.id);
    await signIn(page, "en", user);
    await page.goto(`/en/w/${first.id}/incomes`);
    await expect(page.getByText("RTL regression income")).toHaveCount(2);

    await page.locator("#workspace-switcher").selectOption(second.id);
    await page.waitForURL(new RegExp(`/en/w/${second.id}/dashboard$`));
    await context.setOffline(true);
    await page.goto(`/en/w/${second.id}/incomes`);
    await expect(page.getByText("RTL regression income")).toHaveCount(0);
  });

  test("O-11: signing in as a different user cannot render prior user data", async ({ page }) => {
    test.skip(!hasE2eEnvironment, "Set local Supabase credentials to exercise user isolation.");
    const firstUser = await createSeededUser();
    const firstWorkspace = await seedWorkspace(firstUser, "Private first workspace");
    await seedIncome(firstUser, firstWorkspace.id);
    await signIn(page, "en", firstUser);
    await page.goto(`/en/w/${firstWorkspace.id}/incomes`);
    await expect(page.getByText("RTL regression income")).toHaveCount(2);
    await page.getByRole("button", { name: "Sign out" }).click();

    const secondUser = await createSeededUser();
    await signIn(page, "en", secondUser);
    await expect(page.getByText("RTL regression income")).toHaveCount(0);
    await expect(page.getByText("Private first workspace")).toHaveCount(0);
  });

  test("O-12: a session with no valid cookies is refused a protected route and shows no workspace content", async ({ page, context }) => {
    // This exercises the server-side auth middleware's gate (cookies cleared, then
    // reload) — real session expiry after an offline period is more often detected
    // client-side, by apiFetch's own 401 handler while the SPA is still mounted; that
    // path (and its query-cache-clearing) is covered directly in
    // lib/api/__tests__/client.test.ts, since a manually-cleared-cookie e2e reload
    // cannot distinguish "the client handler works" from "middleware alone caught it."
    test.skip(!hasE2eEnvironment, "Set local Supabase credentials to exercise session expiry.");
    const user = await createSeededUser();
    const workspace = await seedWorkspace(user, "Expiry workspace");
    await signIn(page, "en", user);
    await page.goto(`/en/w/${workspace.id}/dashboard`);
    await context.setOffline(true);
    await page.reload();
    await context.setOffline(false);
    await context.clearCookies();
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload();
    await expect(page).toHaveURL(/\/en\/sign-in$/);
    await expect(page.getByText("Expiry workspace")).toHaveCount(0);
  });

  test("SC-009: persistent browser storage contains neither financial data nor secrets", async ({ page }) => {
    await page.goto("/en/sign-in");
    const storage = await page.evaluate(async () => {
      const cacheEntries = await Promise.all((await caches.keys()).map(async (name) => (await caches.open(name)).keys()));
      const indexed = indexedDB.databases ? await indexedDB.databases() : [];
      return {
        local: Object.entries(localStorage),
        session: Object.entries(sessionStorage),
        indexed: indexed.map((database) => database.name ?? ""),
        cache: cacheEntries.flat().map((request) => request.url),
      };
    });
    const serialized = JSON.stringify(storage).toLowerCase();
    expect(serialized).not.toMatch(/income|expense|amount_minor|receipt|api[_ -]?key|vault/);
    expect(storage.cache.every((url) => /\/(?:_next\/static\/|icons\/|manifest\.webmanifest|(?:ar|en)\/offline)/.test(new URL(url).pathname))).toBe(true);
  });
});
