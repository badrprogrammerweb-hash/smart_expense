import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/**
 * Builds a route's `generateMetadata` from an existing translation key.
 *
 * Every route rendered the same `Smart Expense - AI` tab title, so open tabs
 * were indistinguishable and browser history was unusable for navigation
 * (BUG-17). The page name is the only per-route part; the product suffix comes
 * from the root layout's `title.template`, so the format lives in one place.
 *
 * The locale is read from the route params rather than request headers so this
 * also resolves during Capacitor's static export, where there is no request.
 */
export function createPageMetadata(namespace: string, key: string) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace });

    return { title: t(key) };
  };
}
