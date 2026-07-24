"use client";

import { useTranslations } from "next-intl";

import { useIndeterminateOutcome } from "@/components/connectivity/ConnectivityProvider";

export function IndeterminateOutcomeNotice() {
  const visible = useIndeterminateOutcome();
  const t = useTranslations("pwa.offline");
  return visible ? <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="alert">{t("indeterminate")}</div> : null;
}
