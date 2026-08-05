import { isLocale, type Locale } from "@/i18n/routing";
import { getMe } from "@/lib/api/me";
import type { WorkspaceSummary } from "@/lib/api/workspaces";
import { getWorkspaces } from "@/lib/api/workspaces";
import { readLastWorkspaceId, writeLastWorkspaceId } from "@/lib/workspace-context";

const EXPLICIT_LOCALE_KEY = "smart-expense.explicitLocale";

type RouterLike = {
  replace(href: string, options?: { locale?: Locale }): void;
};

function pickWorkspace(workspaces: WorkspaceSummary[]) {
  const lastWorkspaceId = readLastWorkspaceId();
  const lastWorkspace = workspaces.find((workspace) => workspace.id === lastWorkspaceId);
  const personalWorkspace = workspaces.find((workspace) => workspace.type === "personal");

  return lastWorkspace ?? personalWorkspace ?? workspaces[0];
}

export function rememberExplicitLocale(locale: Locale) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(EXPLICIT_LOCALE_KEY, locale);
}

function hasExplicitLocaleChoice(locale: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(EXPLICIT_LOCALE_KEY) === locale;
}

function preferredAuthLocale(currentLocale: string, storedLocale: Locale): Locale {
  if (!isLocale(currentLocale) || currentLocale === storedLocale) {
    // The `!isLocale` branch is theoretical: the URL locale segment is
    // always validated by the locale layout before this runs.
    return currentLocale as Locale;
  }

  return hasExplicitLocaleChoice(currentLocale) ? currentLocale : storedLocale;
}

export async function redirectToPreferredWorkspace(locale: string, router: RouterLike) {
  const [profile, { workspaces }] = await Promise.all([getMe(), getWorkspaces()]);
  const workspace = pickWorkspace(workspaces);
  const nextLocale = preferredAuthLocale(locale, profile.locale);

  // Routed through next-intl's own router (not a bare path built from
  // `nextLocale`) so that a stored profile locale that differs from the URL
  // locale writes the NEXT_LOCALE cookie the same way an explicit switcher
  // choice does. Since next-intl 4.13.3 the middleware only refreshes that
  // cookie for a document request, so a soft navigation that changes locale
  // without going through this router leaves the cookie stale (see
  // i18n/navigation.ts).
  if (!workspace) {
    router.replace("/", { locale: nextLocale });
    return;
  }

  writeLastWorkspaceId(workspace.id);
  router.replace(`/w/${workspace.id}/dashboard`, { locale: nextLocale });
}
