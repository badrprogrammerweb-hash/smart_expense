import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { directionForLocale, isLocale } from "@/i18n/routing";

import "./globals.css";

// Resolved from Phase 14's --primary token in globals.css (oklch(0.42 0.12 174)).
const phase14BrandThemeColor = "#006148";

const tajawal = Tajawal({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Smart Expense - AI",
  description: "Saudi-first expense tracking workspace",
};

export const viewport: Viewport = {
  themeColor: phase14BrandThemeColor,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const requested = await getLocale();
  const locale = isLocale(requested) ? requested : "en";

  return (
    <html lang={locale} dir={directionForLocale(locale)}>
      <body className={tajawal.variable}>{children}</body>
    </html>
  );
}
