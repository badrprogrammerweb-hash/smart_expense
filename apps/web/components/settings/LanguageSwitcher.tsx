"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";
import { MutationDisabledNotice, useConnectivity } from "@/components/connectivity";
import { updateLocale } from "@/lib/api/me";
import { rememberExplicitLocale } from "@/lib/auth-routing";
import { cn } from "@/lib/utils";

// Each option is always labeled in its own language, not the current
// locale's translation of it; otherwise a user who cannot read the active
// language has no way to find their own in the switcher.
const nativeLabel: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("settings");
  const [error, setError] = useState<string | null>(null);
  const { canMutate } = useConnectivity();

  async function switchTo(nextLocale: Locale) {
    if (nextLocale === locale || !canMutate) {
      return;
    }

    setError(null);
    try {
      await updateLocale(nextLocale);
    } catch {
      setError(t("languagePreferenceSaveError"));
    }

    rememberExplicitLocale(nextLocale);
    // `pathname` is already locale-stripped here, so the locale comes from the
    // option rather than from rewriting the first segment. Going through
    // next-intl's router is what keeps the NEXT_LOCALE cookie in step with the
    // choice (see i18n/navigation.ts) — the cookie is the only thing carrying
    // the language across a sign-out into the signed-out root redirect.
    router.push(pathname, { locale: nextLocale });
  }

  return (
    <div className="mt-3" role="group" aria-label={t("language")}><div className="inline-flex rounded-md border">
      {locales.map((option) => (
        <button
          key={option}
          aria-pressed={option === locale}
          className={cn(
            "min-h-11 px-3 py-2 text-sm font-medium first:rounded-s-md last:rounded-e-md",
            option === locale
              ? "bg-primary text-primary-foreground"
              : "bg-background text-foreground hover:bg-muted",
          )}
          onClick={() => void switchTo(option)}
          disabled={!canMutate}
          type="button"
        >
          {nativeLabel[option]}
        </button>
      ))}
      </div>{error && (
        <p className="sr-only" role="status">
          {error}
        </p>
      )}
      <MutationDisabledNotice />
    </div>
  );
}
