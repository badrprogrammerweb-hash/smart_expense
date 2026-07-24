import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// FR-029: a session that expired while offline must, on reconnect, return the
// user to sign-in without exposing cached workspace data from the expired
// session. The e2e coverage for this scenario (cache-isolation.spec.ts's O-12)
// manually clears cookies/storage before reloading, which only proves the
// server-side auth middleware gates protected routes — it never exercises
// this module's own 401 handler at all. This tests that handler directly:
// a real 401 response from the backend must clear the in-memory query cache
// BEFORE navigating to sign-in, not rely on the navigation alone to do it.

const clearInMemoryQueryCacheMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/query-client", () => ({
  clearInMemoryQueryCache: clearInMemoryQueryCacheMock,
}));

const getSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getSession: getSessionMock },
  }),
}));

describe("apiFetch 401 handling", () => {
  const assignMock = vi.fn();
  const callOrder: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    callOrder.length = 0;
    clearInMemoryQueryCacheMock.mockReset().mockImplementation(() => callOrder.push("clear"));
    assignMock.mockReset().mockImplementation(() => callOrder.push("assign"));
    getSessionMock.mockReset().mockResolvedValue({ data: { session: { access_token: "expired-but-present" } } });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, pathname: "/en/w/workspace-1/dashboard", assign: assignMock },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears the in-memory query cache before redirecting to sign-in on a real 401 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "session_expired", message: "Session expired" } }), {
          status: 401,
        }),
      ),
    );

    const { apiFetch, ApiError } = await import("@/lib/api/client");

    await expect(apiFetch("/workspaces/workspace-1/dashboard")).rejects.toBeInstanceOf(ApiError);

    expect(clearInMemoryQueryCacheMock).toHaveBeenCalledOnce();
    expect(assignMock).toHaveBeenCalledWith("/en/sign-in");
    expect(callOrder).toEqual(["clear", "assign"]);
  });

  it("does not clear the query cache or redirect on a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));

    const { apiFetch } = await import("@/lib/api/client");
    await apiFetch("/workspaces/workspace-1/dashboard");

    expect(clearInMemoryQueryCacheMock).not.toHaveBeenCalled();
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("does not clear the query cache or redirect on an ordinary 4xx that is not 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "validation_failed", message: "Bad input" } }), { status: 422 }),
      ),
    );

    const { apiFetch, ApiError } = await import("@/lib/api/client");
    await expect(apiFetch("/workspaces/workspace-1/dashboard")).rejects.toBeInstanceOf(ApiError);

    expect(clearInMemoryQueryCacheMock).not.toHaveBeenCalled();
    expect(assignMock).not.toHaveBeenCalled();
  });
});
