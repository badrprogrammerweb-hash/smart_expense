"use client";

import { useTranslations } from "next-intl";

import { useConnectivity } from "@/components/connectivity/ConnectivityProvider";

export function MutationDisabledNotice() {
  const { canMutate } = useConnectivity();
  const t = useTranslations("pwa.offline");
  return canMutate ? null : <p className="mt-2 text-sm text-muted-foreground" role="note">{t("mutationsDisabled")}</p>;
}
