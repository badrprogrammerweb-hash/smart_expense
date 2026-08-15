import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

/**
 * BUG-17: every route served the same `Smart Expense - AI` tab title, so open
 * tabs were indistinguishable and history/bookmarks could not be navigated.
 *
 * The wiring — `createPageMetadata` + a `layout.tsx` per route — resolves
 * through `getTranslations`, which is server-only and cannot be invoked under
 * jsdom. What is asserted here is the data those layouts consume: that a
 * localized, distinct name exists for every route in both catalogues. The
 * rendered `document.title` is covered by `e2e/page-titles.spec.ts`.
 */
const ROUTE_TITLE_KEYS: Array<[string, string, string]> = [
  ["dashboard", "nav", "dashboard"],
  ["incomes", "nav", "incomes"],
  ["expenses", "nav", "expenses"],
  ["reports", "nav", "reports"],
  ["history", "nav", "history"],
  ["categories", "nav", "categories"],
  ["files", "nav", "files"],
  ["extractions", "nav", "extractions"],
  ["settings", "nav", "settings"],
  ["new-workspace", "workspace", "createWorkspace"],
  ["offline", "pwa.offline", "title"],
  ["settings/support", "supportPurchases", "pageTitle"],
  ["settings/support/result", "supportPurchases", "resultPageTitle"],
  ["sign-in", "auth", "signInTitle"],
  ["sign-up", "auth", "signUpTitle"],
  ["reset-password", "auth", "resetTitle"],
];

// `namespace` may be dotted (`pwa.offline`), matching what next-intl accepts.
const read = (messages: unknown, namespace: string, key: string) =>
  [...namespace.split("."), key].reduce<unknown>(
    (node, segment) => (node as Record<string, unknown> | undefined)?.[segment],
    messages,
  ) as string | undefined;

describe("every route has a localized page title to put in the tab", () => {
  it.each(ROUTE_TITLE_KEYS)("%s has a non-empty English title", (_route, namespace, key) => {
    expect(read(enMessages, namespace, key)?.trim()).toBeTruthy();
  });

  it.each(ROUTE_TITLE_KEYS)("%s has a non-empty Arabic title", (_route, namespace, key) => {
    expect(read(arMessages, namespace, key)?.trim()).toBeTruthy();
  });

  it("gives each route a title distinct from the others", () => {
    const titles = ROUTE_TITLE_KEYS.map(([, ns, key]) => read(enMessages, ns, key));

    expect(new Set(titles).size).toBe(titles.length);
  });

  it("translates the Arabic titles rather than reusing the English ones", () => {
    for (const [route, namespace, key] of ROUTE_TITLE_KEYS) {
      const ar = read(arMessages, namespace, key);
      const en = read(enMessages, namespace, key);

      expect(ar, `${route} is not translated`).not.toBe(en);
      // Arabic titles must actually contain Arabic script, not transliteration.
      expect(ar, `${route} has no Arabic script`).toMatch(/[؀-ۿ]/);
    }
  });
});

/**
 * The list above only covers routes someone remembered to add. A route created
 * without a `generateMetadata` silently falls back to the root layout's generic
 * `Smart Expense - AI`, which is the very state BUG-17 reported — and it fails
 * silently, so nothing else would catch it. Walk the router instead of trusting
 * the list.
 */
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "app");
const LOCALE_ROOT = join(APP_DIR, "[locale]");

function findRouteDirs(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const here = entries.some((entry) => entry.isFile() && entry.name === "page.tsx") ? [dir] : [];

  return entries
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => findRouteDirs(join(dir, entry.name)))
    .concat(here);
}

/** Next.js resolves metadata from the nearest ancestor segment that sets it. */
function hasTitleInSegmentChain(routeDir: string): boolean {
  let current = routeDir;

  while (current.startsWith(LOCALE_ROOT)) {
    try {
      if (readFileSync(join(current, "layout.tsx"), "utf8").includes("createPageMetadata")) {
        return true;
      }
    } catch {
      // No layout at this segment; keep walking up.
    }

    current = dirname(current);
  }

  return false;
}

/**
 * `/[locale]` itself renders only a spinner while it redirects to sign-in or
 * the preferred workspace, so it is never a tab anyone keeps open. The generic
 * product title is the right one there.
 */
const ROUTES_WITHOUT_OWN_TITLE = new Set(["."]);

describe("no route falls back to the generic product title", () => {
  it("gives every [locale] route its own title via a layout in its segment chain", () => {
    const untitled = findRouteDirs(LOCALE_ROOT)
      .filter((routeDir) => !hasTitleInSegmentChain(routeDir))
      .map((routeDir) => relative(LOCALE_ROOT, routeDir).split(sep).join("/") || ".")
      .filter((route) => !ROUTES_WITHOUT_OWN_TITLE.has(route));

    expect(untitled).toEqual([]);
  });
});
