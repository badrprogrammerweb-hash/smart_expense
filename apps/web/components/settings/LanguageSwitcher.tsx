"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { isLocale, locales, type Locale } from "@/i18n/routing";
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
    const segments = pathname.split("/");
    if (isLocale(segments[1])) {
      segments[1] = nextLocale;
    }
    router.push(segments.join("/") || "/");
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
