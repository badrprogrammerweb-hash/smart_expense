"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { redirectToPreferredWorkspace } from "@/lib/auth-routing";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LocaleHomePage() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("common");
  const errors = useTranslations("errors");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function routeUser() {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace(`/${locale}/sign-in`);
        return;
      }

      try {
        await redirectToPreferredWorkspace(locale, router);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : errors("requestFailed"));
        }
      }
    }

    void routeUser();

    return () => {
      cancelled = true;
    };
  }, [errors, locale, router]);

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="max-w-md rounded-lg border bg-card p-6 text-center text-card-foreground shadow-sm">
        <h1 className="text-xl font-semibold">{t("appName")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error ?? t("loading")}</p>
      </section>
    </main>
  );
}
