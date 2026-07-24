"use client";

import { useLocale, useTranslations } from "next-intl";

import { useConnectivity } from "@/components/connectivity/ConnectivityProvider";

export function StaleDataNotice() {
  const { status, lastOnlineAt } = useConnectivity();
  const locale = useLocale();
  const t = useTranslations("pwa.cached");
  if (status === "online" || !lastOnlineAt) return null;
  const time = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(lastOnlineAt);
  return <p className="mb-3 text-sm text-muted-foreground" data-testid="cached-data-notice">{t("lastUpdated", { time })}</p>;
}
