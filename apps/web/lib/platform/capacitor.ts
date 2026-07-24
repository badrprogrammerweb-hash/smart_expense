export type NativePlatform = "android" | "ios" | "web";

type SecureStorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
    __SMART_EXPENSE_PENDING_DEEP_LINK__?: string;
    __SMART_EXPENSE_NATIVE__?: { secureSession: SecureStorageAdapter };
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

export function nativeCapabilities() {
  return {
    camera: isNative(),
    deepLinks: isNative(),
    secureStorage: nativeSecureSession() !== null,
    safeArea: isNative(),
    statusBar: isNative(),
  };
}

export function subscribeToNativeDeepLinks(callback: (url: string) => void) {
  if (typeof window === "undefined") return () => undefined;
  if (window.__SMART_EXPENSE_PENDING_DEEP_LINK__) {
    callback(window.__SMART_EXPENSE_PENDING_DEEP_LINK__);
    window.__SMART_EXPENSE_PENDING_DEEP_LINK__ = undefined;
  }

  const listener = (event: Event) => callback((event as CustomEvent<{ url: string }>).detail.url);
  window.addEventListener("smart-expense:app-url-open", listener);
  return () => window.removeEventListener("smart-expense:app-url-open", listener);
}
