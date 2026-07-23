"use client";

import { useTranslations } from "next-intl";

import { useConnectivity } from "@/components/connectivity/ConnectivityProvider";

export function OfflineBanner() {
  const { status } = useConnectivity();
  const t = useTranslations("pwa.offline");
  if (status === "online") return null;

  return <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950" role="status" data-connectivity={status}><strong>{status === "offline" ? t("title") : t("degraded")}</strong><span className="ms-2">{t("mutationsDisabled")}</span></div>;
}
