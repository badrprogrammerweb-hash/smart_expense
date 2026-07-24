import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isNative,
  nativeCapabilities,
  nativeSecureSession,
  platform,
  subscribeToNativeDeepLinks,
} from "@/lib/platform/capacitor";

function setCapacitor(overrides: { isNativePlatform?: boolean; platform?: string } | undefined) {
  if (!overrides) {
    delete (window as { Capacitor?: unknown }).Capacitor;
    return;
  }

  window.Capacitor = {
    isNativePlatform: () => overrides.isNativePlatform ?? false,
    getPlatform: () => overrides.platform ?? "web",
  };
}

afterEach(() => {
  setCapacitor(undefined);
  window.__SMART_EXPENSE_PENDING_DEEP_LINK__ = undefined;
  window.__SMART_EXPENSE_NATIVE__ = undefined;
});

describe("isNative / platform", () => {
  it("is false with no Capacitor global (ordinary web)", () => {
    expect(isNative()).toBe(false);
    expect(platform()).toBe("web");
  });

  it("reflects the native platform when Capacitor reports one", () => {
    setCapacitor({ isNativePlatform: true, platform: "ios" });
    expect(isNative()).toBe(true);
    expect(platform()).toBe("ios");
  });

  it("falls back to 'web' for an unrecognised platform string", () => {
    setCapacitor({ isNativePlatform: true, platform: "electron" });
    expect(platform()).toBe("web");
  });
});

describe("nativeSecureSession / nativeCapabilities", () => {
  // contracts/on-device-security.md: nothing native-only may be exposed on
  // ordinary web, regardless of what happens to be attached to `window`.
  it("is null on ordinary web even if a native bridge object is present", () => {
    window.__SMART_EXPENSE_NATIVE__ = { secureSession: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() } };
    expect(nativeSecureSession()).toBeNull();
    expect(nativeCapabilities().secureStorage).toBe(false);
  });

  it("exposes the bridge's secure session only when native", () => {
    setCapacitor({ isNativePlatform: true, platform: "android" });
    const secureSession = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() };
    window.__SMART_EXPENSE_NATIVE__ = { secureSession };
    expect(nativeSecureSession()).toBe(secureSession);
    expect(nativeCapabilities().secureStorage).toBe(true);
  });
});

// This is regression coverage for a real bug: a deep-link URL delivered while
// a subscriber is already listening (the live-event path) left the pending
// flag set forever, because only the "already pending at subscribe time"
// path cleared it. A later, unrelated remount of the subscriber (e.g. a
// locale change) then immediately replayed the stale, already-consumed URL —
// which for an OAuth PKCE code can only fail the exchange and wrongly bounce
// an already signed-in user back to sign-in.
describe("subscribeToNativeDeepLinks", () => {
  beforeEach(() => {
    setCapacitor({ isNativePlatform: true, platform: "android" });
  });

  it("delivers a pending cold-start URL immediately and clears the flag", () => {
    window.__SMART_EXPENSE_PENDING_DEEP_LINK__ = "smartexpense://auth/callback?code=cold-start";
    const callback = vi.fn();

    subscribeToNativeDeepLinks(callback);

    expect(callback).toHaveBeenCalledWith("smartexpense://auth/callback?code=cold-start");
    expect(window.__SMART_EXPENSE_PENDING_DEEP_LINK__).toBeUndefined();
  });

  it("delivers a live appUrlOpen event to an already-subscribed listener", () => {
    const callback = vi.fn();
    subscribeToNativeDeepLinks(callback);

    window.dispatchEvent(
      new CustomEvent("smart-expense:app-url-open", { detail: { url: "smartexpense://auth/callback?code=live" } }),
    );

    expect(callback).toHaveBeenCalledWith("smartexpense://auth/callback?code=live");
  });

  it("clears the pending flag after a live delivery so a later subscriber never replays it", () => {
    // Simulates: subscriber A is already listening when the native side sets
    // the flag AND dispatches the live event in the same tick (the flag is
    // set unconditionally by the native side regardless of whether a
    // listener exists yet).
    const firstCallback = vi.fn();
    const unsubscribeFirst = subscribeToNativeDeepLinks(firstCallback);

    window.__SMART_EXPENSE_PENDING_DEEP_LINK__ = "smartexpense://auth/callback?code=already-consumed";
    window.dispatchEvent(
      new CustomEvent("smart-expense:app-url-open", {
        detail: { url: "smartexpense://auth/callback?code=already-consumed" },
      }),
    );
    expect(firstCallback).toHaveBeenCalledOnce();
    unsubscribeFirst();

    // A later, unrelated remount (e.g. NativeDeepLinkRouter remounting on a
    // locale change) must NOT immediately replay the already-handled URL.
    const secondCallback = vi.fn();
    subscribeToNativeDeepLinks(secondCallback);

    expect(secondCallback).not.toHaveBeenCalled();
  });

  it("stops delivering events after the returned unsubscribe function is called", () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToNativeDeepLinks(callback);
    unsubscribe();

    window.dispatchEvent(
      new CustomEvent("smart-expense:app-url-open", { detail: { url: "smartexpense://auth/callback?code=after-unsub" } }),
    );

    expect(callback).not.toHaveBeenCalled();
  });
});
