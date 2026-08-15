import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import type { ReactNode } from "react";

import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";

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
  // Routes supply only their own page name; the product suffix is applied here
  // so the tab-title format is defined once (BUG-17). `default` covers routes
  // that set no title of their own.
  title: {
    default: "Smart Expense - AI",
    template: "%s · Smart Expense - AI",
  },
  description: "Saudi-first expense tracking workspace",
};

export const viewport: Viewport = {
  themeColor: phase14BrandThemeColor,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // The root cannot read request locale here: doing so makes fallback renders
    // for generated workspace routes fail with DYNAMIC_SERVER_USAGE in a
    // production server. LocaleDirectionSync updates both attributes from the
    // validated [locale] segment before the shared UI becomes interactive.
    <html lang="en" dir="ltr">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className={tajawal.variable}><ServiceWorkerRegistrar />{children}</body>
    </html>
  );
}
