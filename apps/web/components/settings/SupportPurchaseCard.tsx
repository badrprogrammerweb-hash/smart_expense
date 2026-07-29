"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { isLocale } from "@/i18n/routing";


export function SupportPurchaseCard() {
  const localeValue = useLocale();
  const locale = isLocale(localeValue) ? localeValue : "en";
  const t = useTranslations("supportPurchases");

  return (
    <section
      className="rounded-[var(--radius-card)] border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)]"
      data-testid="support-purchase-card"
    >
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          {t("eyebrow")}
        </p>
        <h2 className="mt-2 text-xl font-semibold">{t("title")}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("description")}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("unchangedProduct")}</p>
      </div>
      <Link
        className={buttonVariants({ variant: "primary" }) + " mt-5"}
        href={`/${locale}/settings/support`}
      >
        {t("openAction")}
      </Link>
    </section>
  );
}
