"use client";

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/ui";

export function HistoryEmptyState() {
  const t = useTranslations("history");

  return <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />;
}
