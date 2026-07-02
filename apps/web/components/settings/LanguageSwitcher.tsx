"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

import { isLocale, locales, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

// Each option is always labeled in its own language, not the current
// locale's translation of it — otherwise a user who can't read the
// active language has no way to find their own in the switcher.
const nativeLabel: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("settings");

  function switchTo(nextLocale: Locale) {
    if (nextLocale === locale) {
      return;
    }

    // No separate persistence needed here: next-intl's middleware sets a
    // NEXT_LOCALE cookie on every locale-prefixed request (this navigation
    // included) and reads it back for the root `/` redirect, so the choice
    // already survives sign-out without any app code.
    const segments = pathname.split("/");
    if (isLocale(segments[1])) {
      segments[1] = nextLocale;
    }
    router.push(segments.join("/") || "/");
  }

  return (
    <div className="mt-3 inline-flex rounded-md border" role="group" aria-label={t("language")}>
      {locales.map((option) => (
        <button
          key={option}
          aria-pressed={option === locale}
          className={cn(
            "px-3 py-2 text-sm font-medium first:rounded-s-md last:rounded-e-md",
            option === locale
              ? "bg-primary text-primary-foreground"
              : "bg-background text-foreground hover:bg-muted",
          )}
          onClick={() => switchTo(option)}
          type="button"
        >
          {nativeLabel[option]}
        </button>
      ))}
    </div>
  );
}
