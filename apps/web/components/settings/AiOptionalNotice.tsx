"use client";

import { useTranslations } from "next-intl";

export function AiOptionalNotice() {
  const t = useTranslations("settings");

  return (
    <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
      <h2 className="text-lg font-semibold">{t("aiTitle")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("aiDescription")}</p>
    </section>
  );
}
