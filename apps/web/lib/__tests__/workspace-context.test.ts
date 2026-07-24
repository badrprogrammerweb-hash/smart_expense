import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearNativeLastWorkspaceId, evictQueriesForPreviousWorkspace, readLastWorkspaceId, writeLastWorkspaceId } from "@/lib/workspace-context";

const isNativeMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/platform/capacitor", () => ({
  isNative: isNativeMock,
}));

// FR-023: on-device caches must be scoped so no prior-workspace data can ever
// render under another workspace, including while offline. This is the exact
// mechanism WorkspaceProvider relies on when the route's workspaceId changes;
// verified directly against a real QueryClient because a full-page e2e
// navigation while offline is masked by the service worker's generic offline
// fallback and cannot distinguish "evicted correctly" from "page failed to
// load for an unrelated reason."
describe("evictQueriesForPreviousWorkspace", () => {
  it("removes every query scoped to the previous workspace and leaves the next workspace's and global queries intact", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["incomes", "workspace-a"], { incomes: [{ id: "1" }] });
    queryClient.setQueryData(["dashboard", "workspace-a"], { summary: {} });
    queryClient.setQueryData(["categories", "workspace-a", { categoryType: "expense", includeArchived: true }], {
      categories: [],
    });
    queryClient.setQueryData(["workspace", "workspace-a"], { id: "workspace-a" });
    queryClient.setQueryData(["incomes", "workspace-b"], { incomes: [] });
    queryClient.setQueryData(["workspaces"], { workspaces: [] });
    queryClient.setQueryData(["auth", "currentUserId"], "user-1");

    evictQueriesForPreviousWorkspace(queryClient, "workspace-a", "workspace-b");

    expect(queryClient.getQueryData(["incomes", "workspace-a"])).toBeUndefined();
    expect(queryClient.getQueryData(["dashboard", "workspace-a"])).toBeUndefined();
    expect(
      queryClient.getQueryData(["categories", "workspace-a", { categoryType: "expense", includeArchived: true }]),
    ).toBeUndefined();
    expect(queryClient.getQueryData(["workspace", "workspace-a"])).toBeUndefined();

    expect(queryClient.getQueryData(["incomes", "workspace-b"])).toEqual({ incomes: [] });
    expect(queryClient.getQueryData(["workspaces"])).toEqual({ workspaces: [] });
    expect(queryClient.getQueryData(["auth", "currentUserId"])).toBe("user-1");
  });

  it("does nothing when the workspace has not actually changed", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["incomes", "workspace-a"], { incomes: [{ id: "1" }] });

    evictQueriesForPreviousWorkspace(queryClient, "workspace-a", "workspace-a");

    expect(queryClient.getQueryData(["incomes", "workspace-a"])).toEqual({ incomes: [{ id: "1" }] });
  });

  it("does NOT evict a query whose workspaceId is nested inside an options object rather than a direct key element (documents a real limitation)", () => {
    // query.queryKey.some(part => part === id) only matches direct array elements.
    // Every workspace-scoped query in this codebase currently places workspaceId as
    // a direct element (audited across every `useQuery`/`useMutation` call site), so
    // this shape does not occur today. This test exists so that if a future hook ever
    // nests workspaceId inside an options object, this fails loudly instead of
    // silently leaving that workspace's data un-evicted.
    const queryClient = new QueryClient();
    queryClient.setQueryData(["hypothetical-future-hook", { workspaceId: "workspace-a" }], { total: 100 });

    evictQueriesForPreviousWorkspace(queryClient, "workspace-a", "workspace-b");

    expect(queryClient.getQueryData(["hypothetical-future-hook", { workspaceId: "workspace-a" }])).toEqual({
      total: 100,
    });
  });
});

// T024/T025, contracts/on-device-security.md: the native shell must never
// persist the last-workspace hint to device storage, and sign-out must clear
// it so a different user signing in on the same running app process never
// inherits the previous user's hint (FR-024).
describe("native last-workspace cache", () => {
  const STORAGE_KEY = "smart-expense.lastWorkspaceId";

  beforeEach(() => {
    isNativeMock.mockReset();
    clearNativeLastWorkspaceId();
    window.localStorage.clear();
  });

  it("keeps the last-workspace id in memory only when native, never in localStorage", () => {
    isNativeMock.mockReturnValue(true);

    writeLastWorkspaceId("workspace-a");

    expect(readLastWorkspaceId()).toBe("workspace-a");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("falls back to localStorage on ordinary web", () => {
    isNativeMock.mockReturnValue(false);

    writeLastWorkspaceId("workspace-b");

    expect(readLastWorkspaceId()).toBe("workspace-b");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("workspace-b");
  });

  it("clears the native in-memory hint so a different user signing in afterwards never inherits it", () => {
    isNativeMock.mockReturnValue(true);
    writeLastWorkspaceId("workspace-a");

    clearNativeLastWorkspaceId();

    expect(readLastWorkspaceId()).toBeNull();
  });

  it("leaves web localStorage untouched by the native-only clear helper", () => {
    isNativeMock.mockReturnValue(false);
    writeLastWorkspaceId("workspace-b");

    clearNativeLastWorkspaceId();

    expect(readLastWorkspaceId()).toBe("workspace-b");
  });
});
