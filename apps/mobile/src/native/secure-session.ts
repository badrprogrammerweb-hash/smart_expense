import { SecureStorage } from "@aparajita/capacitor-secure-storage";

const SESSION_KEY_PREFIX = "smart-expense.supabase.";

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
    await SecureStorage.setItem(`${SESSION_KEY_PREFIX}${key}`, value);
  },
  async removeItem(key: string): Promise<void> {
    await SecureStorage.removeItem(`${SESSION_KEY_PREFIX}${key}`);
  },
  async clear(): Promise<void> {
    const keys = await SecureStorage.keys();
    await Promise.all(keys.filter((key) => key.startsWith(SESSION_KEY_PREFIX)).map((key) => SecureStorage.removeItem(key)));
  },
};
