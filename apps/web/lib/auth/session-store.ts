import type { SupportedStorage } from "@supabase/supabase-js";

import { isNative, nativeSecureSession } from "@/lib/platform/capacitor";

const unavailableNativeStorage: SupportedStorage = {
  getItem: async () => { throw new Error("Native secure session storage has not initialised."); },
  setItem: async () => { throw new Error("Native secure session storage has not initialised."); },
  removeItem: async () => { throw new Error("Native secure session storage has not initialised."); },
};

/**
 * Uses the platform Keychain/Keystore bridge in Capacitor and leaves the web
 * client on its existing cookie/browser storage path. It intentionally never
 * falls back to WebView localStorage while native.
 */
export function sessionStorageForRuntime(): SupportedStorage | undefined {
  if (!isNative()) return undefined;
  return nativeSecureSession() ?? unavailableNativeStorage;
}
