"use client";

import type { AuthError } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

/**
 * Supabase Auth returns English operator-facing strings ("Invalid login
 * credentials", "Password should be at least 6 characters"). Those must never
 * be rendered: they are unlocalized, and they describe the auth service rather
 * than the product. Every message the user sees is application-owned copy
 * selected by the structured `code` (see `@supabase/auth-js` `ErrorCode`).
 */
const authErrorKeyByCode: Record<string, string> = {
  invalid_credentials: "invalidCredentials",
  email_not_confirmed: "emailNotConfirmed",
  email_exists: "emailExists",
  user_already_exists: "emailExists",
  weak_password: "weakPassword",
  email_address_invalid: "validationEmail",
  signup_disabled: "signUpDisabled",
  email_provider_disabled: "signUpDisabled",
  user_banned: "invalidCredentials",
  over_request_rate_limit: "rateLimited",
  over_email_send_rate_limit: "rateLimited",
  validation_failed: "validationEmail",
};

/**
 * `code` is absent on failures raised before a response arrives (network,
 * timeout); `status` is then undefined too, so those land on the generic
 * fallback rather than leaking a fetch error string.
 *
 * `credentialFallback` is opt-in because a bare 400 only means "the
 * credentials were rejected" on a form that submitted credentials. Reading it
 * that way on sign-up or password reset would answer a question the user did
 * not ask — password reset has no password field at all.
 */
function keyForAuthError(error: AuthError, credentialFallback: boolean) {
  if (error.code && authErrorKeyByCode[error.code]) {
    return authErrorKeyByCode[error.code];
  }

  if (error.status === 429) {
    return "rateLimited";
  }

  // Older GoTrue responses omit `code` but still signal a rejected credential
  // with a 400/422.
  if (credentialFallback && (error.status === 400 || error.status === 422)) {
    return "invalidCredentials";
  }

  return null;
}

export function useAuthErrorMessage({ credentialFallback = false } = {}) {
  const t = useTranslations("auth.errors");

  return useCallback(
    (error: AuthError | null | undefined) => {
      const key = error ? keyForAuthError(error, credentialFallback) : null;

      return key ? t(key) : t("generic");
    },
    [credentialFallback, t],
  );
}
