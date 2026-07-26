import { afterEach, describe, expect, it, vi } from "vitest";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// FR-008 / contracts/on-device-security.md: the native shell's authenticated
// session must live ONLY in the platform secure store, never in plain WebView
// localStorage — and must survive an app restart (FR-004, T021/T024). This
// verifies the wiring point directly: the browser client is constructed with
// the native secure-storage adapter, `persistSession`, and `autoRefreshToken`
// when running natively, and with no storage override at all on ordinary web,
// where the SDK's own default (browser localStorage) persistence must stay
// untouched.

const createBrowserClientMock = vi.hoisted(() => vi.fn().mockReturnValue({}));
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: createBrowserClientMock,
}));

const sessionStorageForRuntimeMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session-store", () => ({
  sessionStorageForRuntime: sessionStorageForRuntimeMock,
}));

describe("createSupabaseBrowserClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    createBrowserClientMock.mockClear();
    sessionStorageForRuntimeMock.mockReset();
  });

  it("wires the native secure-session adapter with persistSession and autoRefreshToken when running natively", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    const secureStorage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    sessionStorageForRuntimeMock.mockReturnValue(secureStorage);

    createSupabaseBrowserClient();

    expect(createBrowserClientMock).toHaveBeenCalledWith("http://127.0.0.1:54321", "test-anon-key", {
      auth: {
        storage: secureStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  });

  it("passes no storage override on ordinary web, leaving the SDK's own default session persistence untouched", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    sessionStorageForRuntimeMock.mockReturnValue(undefined);

    createSupabaseBrowserClient();

    expect(createBrowserClientMock).toHaveBeenCalledWith("http://127.0.0.1:54321", "test-anon-key", undefined);
  });

  it("throws a clear error when Supabase configuration is missing", () => {
    sessionStorageForRuntimeMock.mockReturnValue(undefined);

    expect(() => createSupabaseBrowserClient()).toThrow(/Missing NEXT_PUBLIC_SUPABASE_URL/);
  });
});
