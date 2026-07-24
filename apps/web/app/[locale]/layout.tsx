import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { LocaleDirectionSync } from "@/components/layout/LocaleDirectionSync";
import { AppProviders } from "@/components/providers";
import { isLocale, locales } from "@/i18n/routing";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  // Makes the locale explicit during Capacitor's static export rather than
  // falling back to request headers. The normal web middleware path is
  // unaffected.
  setRequestLocale(locale);

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LocaleDirectionSync />
      <AppProviders>{children}</AppProviders>
    </NextIntlClientProvider>
  );
}
