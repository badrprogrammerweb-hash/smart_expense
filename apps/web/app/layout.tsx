import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { directionForLocale, isLocale } from "@/i18n/routing";

import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Expense - AI",
  description: "Saudi-first expense tracking workspace",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const requested = await getLocale();
  const locale = isLocale(requested) ? requested : "en";

  return (
    <html lang={locale} dir={directionForLocale(locale)}>
      <body>{children}</body>
    </html>
  );
}
