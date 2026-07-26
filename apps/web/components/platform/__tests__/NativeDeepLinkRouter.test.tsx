import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NativeDeepLinkRouter } from "@/components/platform/NativeDeepLinkRouter";

// T023 / contracts/auth-deeplink.md: provider (OAuth) sign-in returns through
// a registered deep link and must complete the session by exchanging the PKCE
// `code` Supabase appends to the redirect URL — never by treating the mere
// presence of the deep link as authenticated. A cancelled/failed provider flow
// (no code, or a failed exchange) must return cleanly to sign-in with no
// partial session (spec.md Edge Cases).

const replaceMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

const unsubscribeMock = vi.hoisted(() => vi.fn());
const subscribeToNativeDeepLinksMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/platform/capacitor", () => ({
  subscribeToNativeDeepLinks: subscribeToNativeDeepLinksMock,
}));

const exchangeCodeForSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { exchangeCodeForSession: exchangeCodeForSessionMock },
  }),
}));

const redirectToPreferredWorkspaceMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth-routing", () => ({
  redirectToPreferredWorkspace: redirectToPreferredWorkspaceMock,
}));

let deepLinkCallback: ((url: string) => void) | undefined;

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("NativeDeepLinkRouter", () => {
  beforeEach(() => {
    deepLinkCallback = undefined;
    subscribeToNativeDeepLinksMock.mockReset().mockImplementation((callback: (url: string) => void) => {
      deepLinkCallback = callback;
      return unsubscribeMock;
    });
    replaceMock.mockReset();
    exchangeCodeForSessionMock.mockReset();
    redirectToPreferredWorkspaceMock.mockReset().mockResolvedValue(undefined);
    unsubscribeMock.mockReset();
  });

  it("ignores a URL that is not the registered auth callback", async () => {
    render(<NativeDeepLinkRouter />);
    deepLinkCallback?.("smartexpense://other/path");
    await flushMicrotasks();

    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("returns cleanly to sign-in with no session exchange when the callback carries no code (cancelled/failed provider flow)", async () => {
    render(<NativeDeepLinkRouter />);
    deepLinkCallback?.("smartexpense://auth/callback?error=access_denied");
    await flushMicrotasks();

    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith("/en/sign-in");
  });

  it("exchanges the PKCE code for a session and lands in the preferred workspace on success", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    render(<NativeDeepLinkRouter />);
    deepLinkCallback?.("smartexpense://auth/callback?code=abc123");
    await flushMicrotasks();

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("abc123");
    expect(redirectToPreferredWorkspaceMock).toHaveBeenCalledWith("en", { replace: replaceMock });
    expect(replaceMock).not.toHaveBeenCalledWith("/en/sign-in");
  });

  it("returns cleanly to sign-in with no partial session when the code exchange fails", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: new Error("invalid code") });
    render(<NativeDeepLinkRouter />);
    deepLinkCallback?.("smartexpense://auth/callback?code=bad-code");
    await flushMicrotasks();

    expect(replaceMock).toHaveBeenCalledWith("/en/sign-in");
    expect(redirectToPreferredWorkspaceMock).not.toHaveBeenCalled();
  });

  it("returns cleanly to sign-in when landing in the preferred workspace fails after a successful exchange", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    redirectToPreferredWorkspaceMock.mockRejectedValue(new Error("network error"));
    render(<NativeDeepLinkRouter />);
    deepLinkCallback?.("smartexpense://auth/callback?code=abc123");
    await flushMicrotasks();

    expect(replaceMock).toHaveBeenCalledWith("/en/sign-in");
  });

  // A genuine network failure mid-exchange (realistic on a mobile connection
  // handing off networks) can reject rather than resolve to `{ error }`. This
  // must still return cleanly to sign-in, not leave the app hanging on an
  // unhandled rejection with nothing visibly happening.
  it("returns cleanly to sign-in when the code exchange itself throws", async () => {
    exchangeCodeForSessionMock.mockRejectedValue(new Error("network error"));
    render(<NativeDeepLinkRouter />);
    deepLinkCallback?.("smartexpense://auth/callback?code=abc123");
    await flushMicrotasks();

    expect(replaceMock).toHaveBeenCalledWith("/en/sign-in");
    expect(redirectToPreferredWorkspaceMock).not.toHaveBeenCalled();
  });

  // Some Android versions are known to redeliver the same appUrlOpen event
  // twice for a single tap. A PKCE code is single-use, so reprocessing it
  // would fail the exchange and wrongly bounce an already signed-in user
  // back to sign-in.
  it("processes an exact repeat of the same URL only once", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    render(<NativeDeepLinkRouter />);
    deepLinkCallback?.("smartexpense://auth/callback?code=abc123");
    deepLinkCallback?.("smartexpense://auth/callback?code=abc123");
    await flushMicrotasks();

    expect(exchangeCodeForSessionMock).toHaveBeenCalledOnce();
  });

  it("unsubscribes from deep-link notifications on unmount", () => {
    const { unmount } = render(<NativeDeepLinkRouter />);
    unmount();

    expect(unsubscribeMock).toHaveBeenCalledOnce();
  });
});
