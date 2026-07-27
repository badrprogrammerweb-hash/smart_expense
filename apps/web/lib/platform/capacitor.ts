export type NativePlatform = "android" | "ios" | "web";

type SecureStorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
};

export type CameraCaptureOutcome =
  | { status: "captured"; file: File }
  | { status: "cancelled" }
  | { status: "permission-denied" }
  | { status: "unavailable" }
  | { status: "failed" };

export type NativeSupportTier = {
  tier_id: "support_small" | "support_medium" | "support_large";
  label: string;
  display_amount: string;
  currency: string;
};

export type NativeMobileVerifyRequest = {
  tier_id: NativeSupportTier["tier_id"];
  channel: "apple" | "google";
  provider_transaction_id: string;
};

export type NativeVerifiedSupportPurchase = {
  id: string;
  tier_id: string;
  channel: "web" | "ios" | "android";
  amount_minor_units: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "refunded";
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  provider_reference: string | null;
};

export type NativeSupportBillingResult =
  | {
      status: "pending";
      purchase?: NativeVerifiedSupportPurchase;
      reason?: "store-pending";
    }
  | { status: "completed"; purchase: NativeVerifiedSupportPurchase }
  | {
      status: "failed";
      purchase?: NativeVerifiedSupportPurchase;
      reason:
        | "cancelled"
        | "refunded"
        | "unavailable"
        | "invalid-transaction"
        | "verification-failed";
    };

export type NativeSupportBillingAdapter = {
  listTiers(tiers: NativeSupportTier[]): Promise<NativeSupportTier[]>;
  purchase(input: {
    tier_id: NativeSupportTier["tier_id"];
    account_id: string;
    verify: (
      request: NativeMobileVerifyRequest,
    ) => Promise<NativeVerifiedSupportPurchase>;
  }): Promise<NativeSupportBillingResult>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
    __SMART_EXPENSE_PENDING_DEEP_LINK__?: string;
    __SMART_EXPENSE_NATIVE__?: {
      secureSession?: SecureStorageAdapter;
      captureFromCamera?: () => Promise<CameraCaptureOutcome>;
      supportBilling?: NativeSupportBillingAdapter;
    };
  }
}

function capacitor(): CapacitorGlobal | undefined {
  return typeof window === "undefined" ? undefined : window.Capacitor;
}

export function isNative() {
  return capacitor()?.isNativePlatform?.() === true;
}

export function platform(): NativePlatform {
  const value = capacitor()?.getPlatform?.();
  return value === "ios" || value === "android" ? value : "web";
}

export function nativeSecureSession(): SecureStorageAdapter | null {
  return isNative() ? window.__SMART_EXPENSE_NATIVE__?.secureSession ?? null : null;
}

export function nativeCamera(): (() => Promise<CameraCaptureOutcome>) | null {
  return isNative() ? window.__SMART_EXPENSE_NATIVE__?.captureFromCamera ?? null : null;
}

export function nativeSupportBilling(): NativeSupportBillingAdapter | null {
  return isNative()
    ? window.__SMART_EXPENSE_NATIVE__?.supportBilling ?? null
    : null;
}

export function nativeCapabilities() {
  return {
    billing: nativeSupportBilling() !== null,
    camera: nativeCamera() !== null,
    deepLinks: isNative(),
    secureStorage: nativeSecureSession() !== null,
    safeArea: isNative(),
    statusBar: isNative(),
  };
}

export function subscribeToNativeDeepLinks(callback: (url: string) => void) {
  if (typeof window === "undefined") return () => undefined;
  if (window.__SMART_EXPENSE_PENDING_DEEP_LINK__) {
    const pendingUrl = window.__SMART_EXPENSE_PENDING_DEEP_LINK__;
    window.__SMART_EXPENSE_PENDING_DEEP_LINK__ = undefined;
    callback(pendingUrl);
  }

  // A cold-start launch URL is delivered exactly once, but the pending flag
  // above is set unconditionally by the native side and only read here on
  // *subscribe*. If a subscriber is already listening when it arrives, it is
  // delivered live below instead — and the flag must still be cleared, or a
  // later, unrelated remount of this subscriber (e.g. a locale change) would
  // replay the same already-consumed URL, re-attempting a one-time PKCE
  // exchange that can only fail and would wrongly bounce an already
  // signed-in user back to sign-in.
  const listener = (event: Event) => {
    window.__SMART_EXPENSE_PENDING_DEEP_LINK__ = undefined;
    callback((event as CustomEvent<{ url: string }>).detail.url);
  };
  window.addEventListener("smart-expense:app-url-open", listener);
  return () => window.removeEventListener("smart-expense:app-url-open", listener);
}
