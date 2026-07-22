"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { redirectToPreferredWorkspace } from "@/lib/auth-routing";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Alert, InfoCard } from "@/components/ui";

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
      <InfoCard title={t("appName")}><div className="mt-2">{error ? <Alert variant="error" title={error} /> : <p className="text-sm text-muted-foreground">{t("loading")}</p>}</div></InfoCard>
    </main>
  );
}
