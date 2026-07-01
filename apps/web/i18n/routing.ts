import { defineRouting } from "next-intl/routing";

export const locales = ["en", "ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export function directionForLocale(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}
