import { KeychainAccess, SecureStorage } from "@aparajita/capacitor-secure-storage";

const SESSION_KEY_PREFIX = "smart-expense.supabase.";

// iOS default Keychain accessibility (`whenUnlocked`) migrates to a new
// device via an encrypted backup restore. The session should stay bound to
// this device only (contracts/on-device-security.md rule 1) — a no-op on
// Android, where the equivalent (SharedPreferences excluded from Auto
// Backup) is set via `android:allowBackup="false"` in the manifest instead.
// Kept as a global default (defense-in-depth for any future keychain write
// elsewhere), but `setItem` below never relies on its timing — it passes the
// access level explicitly on every write instead.
void SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);

/**
 * The only persistent session adapter in the native shell. The plugin maps to
 * Keychain on iOS and Keystore-backed storage on Android; no financial data is
 * written here.
 */
export const secureSession = {
  async getItem(key: string): Promise<string | null> {
    return SecureStorage.getItem(`${SESSION_KEY_PREFIX}${key}`);
  },
  async setItem(key: string, value: string): Promise<void> {
    // Explicit per-call access, not the global default above: this write
    // must never depend on setDefaultKeychainAccess() having already
    // resolved by the time it runs.
    await SecureStorage.set(`${SESSION_KEY_PREFIX}${key}`, value, false, undefined, KeychainAccess.whenUnlockedThisDeviceOnly);
  },
  async removeItem(key: string): Promise<void> {
    await SecureStorage.removeItem(`${SESSION_KEY_PREFIX}${key}`);
  },
  async clear(): Promise<void> {
    const keys = await SecureStorage.keys();
    await Promise.all(keys.filter((key) => key.startsWith(SESSION_KEY_PREFIX)).map((key) => SecureStorage.removeItem(key)));
  },
};
