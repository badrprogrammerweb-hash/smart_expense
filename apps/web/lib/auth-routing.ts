import { isLocale, type Locale } from "@/i18n/routing";
import { getMe } from "@/lib/api/me";
import type { WorkspaceSummary } from "@/lib/api/workspaces";
import { getWorkspaces } from "@/lib/api/workspaces";
import { readLastWorkspaceId, writeLastWorkspaceId } from "@/lib/workspace-context";

const EXPLICIT_LOCALE_KEY = "smart-expense.explicitLocale";

type RouterLike = {
  replace(path: string): void;
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

function preferredAuthLocale(currentLocale: string, storedLocale: Locale) {
  if (!isLocale(currentLocale) || currentLocale === storedLocale) {
    return currentLocale;
  }

  return hasExplicitLocaleChoice(currentLocale) ? currentLocale : storedLocale;
}

export async function redirectToPreferredWorkspace(locale: string, router: RouterLike) {
  const [profile, { workspaces }] = await Promise.all([getMe(), getWorkspaces()]);
  const workspace = pickWorkspace(workspaces);
  const nextLocale = preferredAuthLocale(locale, profile.locale);

  if (!workspace) {
    router.replace(`/${nextLocale}`);
    return;
  }

  writeLastWorkspaceId(workspace.id);
  router.replace(`/${nextLocale}/w/${workspace.id}/dashboard`);
}
