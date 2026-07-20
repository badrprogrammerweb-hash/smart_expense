import type { Locale } from "@/i18n/routing";

import { apiFetch } from "./client";

export type UserProfile = {
  id: string;
  email: string;
  display_name: string | null;
  locale: Locale;
};

export type LocaleUpdateResponse = {
  id: string;
  locale: Locale;
};

export async function getMe() {
  return apiFetch<UserProfile>("/me");
}

export async function updateLocale(locale: Locale) {
  return apiFetch<LocaleUpdateResponse>("/me", {
    method: "PATCH",
    body: JSON.stringify({ locale }),
  });
}
