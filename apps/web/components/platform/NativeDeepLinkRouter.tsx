"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { redirectToPreferredWorkspace } from "@/lib/auth-routing";
import { subscribeToNativeDeepLinks } from "@/lib/platform/capacitor";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type RouterLike = { replace(path: string): void };

/**
 * Completes a provider (OAuth) sign-in returned through the native deep link
 * (contracts/auth-deeplink.md). No provider is currently enabled in Supabase
 * (`supabase/config.toml` has every `[auth.external.*]` disabled), so this app
 * has no "Sign in with X" button today — adding one would introduce a
 * provider that does not exist. What this component provides is the
 * provider-agnostic return-trip plumbing: it exchanges the PKCE `code` Supabase
 * appends to the redirect URL for a session, using the same browser client
 * (and therefore the same native secure-session storage, FR-008) as
 * email/password sign-in. It will work unchanged the moment a provider is
 * enabled, with no further app change.
 */
export function NativeDeepLinkRouter() {
  const locale = useLocale();
  const router = useRouter();
  // Some Android versions are known to redeliver the same appUrlOpen event
  // twice for a single tap. A PKCE code is single-use, so reprocessing it
  // would fail the exchange and wrongly bounce an already signed-in user
  // back to sign-in; skip an exact repeat of the immediately preceding URL.
  const lastHandledUrlRef = useRef<string | null>(null);

  useEffect(() => subscribeToNativeDeepLinks((url) => {
    if (url === lastHandledUrlRef.current) return;
    lastHandledUrlRef.current = url;

    const redirect = new URL(url);
    if (redirect.protocol !== "smartexpense:" || redirect.hostname !== "auth" || redirect.pathname !== "/callback") return;
    void completeNativeOAuthReturn(redirect, locale, router);
  }), [locale, router]);

  return null;
}

async function completeNativeOAuthReturn(redirect: URL, locale: string, router: RouterLike) {
  const code = redirect.searchParams.get("code");

  if (!code) {
    router.replace(`/${locale}/sign-in`);
    return;
  }

  // Wrapped defensively end-to-end: the Supabase SDK returns `{ error }` for
  // most auth failures, but a genuine network failure mid-exchange (a real
  // risk on a mobile connection handing off networks) can throw instead. A
  // provider flow that fails must still return cleanly to sign-in rather than
  // leaving the app on a blank screen with an unhandled rejection.
  try {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      router.replace(`/${locale}/sign-in`);
      return;
    }

    await redirectToPreferredWorkspace(locale, router);
  } catch {
    router.replace(`/${locale}/sign-in`);
  }
}
