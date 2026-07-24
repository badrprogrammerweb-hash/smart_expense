import { createBrowserClient } from "@supabase/ssr";

import { sessionStorageForRuntime } from "@/lib/auth/session-store";

function readSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return { url, anonKey };
}

export function createSupabaseBrowserClient() {
  const { url, anonKey } = readSupabaseConfig();
  const storage = sessionStorageForRuntime();

  return createBrowserClient(url, anonKey, storage ? {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  } : undefined);
}
