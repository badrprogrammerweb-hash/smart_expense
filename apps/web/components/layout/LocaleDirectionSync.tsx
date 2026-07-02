"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";

import { directionForLocale, isLocale } from "@/i18n/routing";

// The root layout (app/layout.tsx) owns <html lang/dir> but, as the layout
// shared by every locale, it does not re-render on a client-side navigation
// between /en/... and /ar/... routes. This keeps <html> in sync with the
// active locale without a full page reload (FR-031).
export function LocaleDirectionSync() {
  const locale = useLocale();

  useEffect(() => {
    if (!isLocale(locale)) {
      return;
    }

    document.documentElement.lang = locale;
    document.documentElement.dir = directionForLocale(locale);
  }, [locale]);

  return null;
}
