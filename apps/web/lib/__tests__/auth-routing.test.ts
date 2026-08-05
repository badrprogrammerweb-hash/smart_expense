import { beforeEach, describe, expect, it, vi } from "vitest";

const getMeMock = vi.hoisted(() => vi.fn());
const getWorkspacesMock = vi.hoisted(() => vi.fn());
const readLastWorkspaceIdMock = vi.hoisted(() => vi.fn());
const writeLastWorkspaceIdMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/me", () => ({ getMe: getMeMock }));
vi.mock("@/lib/api/workspaces", () => ({ getWorkspaces: getWorkspacesMock }));
vi.mock("@/lib/workspace-context", () => ({
  readLastWorkspaceId: readLastWorkspaceIdMock,
  writeLastWorkspaceId: writeLastWorkspaceIdMock,
}));

import { redirectToPreferredWorkspace, rememberExplicitLocale } from "@/lib/auth-routing";

const workspace = {
  id: "workspace-1",
  type: "personal" as const,
  name: "Personal",
  role: "owner" as const,
  currency: "SAR" as const,
  auto_delete_after_extraction: false,
  currency_locked: false,
};

// Since next-intl 4.13.3, the middleware only refreshes the NEXT_LOCALE
// cookie for a document request; a client-side navigation that changes
// locale must go through next-intl's own router (which writes the cookie
// itself) or the cookie goes stale even though the UI shows the right
// language. redirectToPreferredWorkspace is the one place a locale change
// can happen without the user touching the language switcher, so the
// `{ locale }` option on every `router.replace` call is load-bearing.
describe("redirectToPreferredWorkspace", () => {
  beforeEach(() => {
    getMeMock.mockReset();
    getWorkspacesMock.mockReset();
    readLastWorkspaceIdMock.mockReset();
    writeLastWorkspaceIdMock.mockReset();
    window.sessionStorage.clear();
  });

  it("passes the stored profile locale as an explicit router option when it differs from the URL and the user made no explicit choice", async () => {
    getMeMock.mockResolvedValue({ id: "u1", email: "a@example.com", display_name: null, locale: "ar" });
    getWorkspacesMock.mockResolvedValue({ workspaces: [workspace] });
    readLastWorkspaceIdMock.mockReturnValue(null);
    const replace = vi.fn();

    await redirectToPreferredWorkspace("en", { replace });

    expect(replace).toHaveBeenCalledWith(`/w/${workspace.id}/dashboard`, { locale: "ar" });
  });

  it("keeps the URL locale, still passed explicitly, when the user just switched to it in this session", async () => {
    getMeMock.mockResolvedValue({ id: "u1", email: "a@example.com", display_name: null, locale: "ar" });
    getWorkspacesMock.mockResolvedValue({ workspaces: [workspace] });
    readLastWorkspaceIdMock.mockReturnValue(null);
    rememberExplicitLocale("en");
    const replace = vi.fn();

    await redirectToPreferredWorkspace("en", { replace });

    expect(replace).toHaveBeenCalledWith(`/w/${workspace.id}/dashboard`, { locale: "en" });
  });

  it("routes to the bare locale root with an explicit locale option when the profile has no workspace yet", async () => {
    getMeMock.mockResolvedValue({ id: "u1", email: "a@example.com", display_name: null, locale: "ar" });
    getWorkspacesMock.mockResolvedValue({ workspaces: [] });
    const replace = vi.fn();

    await redirectToPreferredWorkspace("en", { replace });

    expect(replace).toHaveBeenCalledWith("/", { locale: "ar" });
    expect(writeLastWorkspaceIdMock).not.toHaveBeenCalled();
  });
});
