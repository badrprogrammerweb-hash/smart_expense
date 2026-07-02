"use client";

import { useTranslations } from "next-intl";

export default function FilesPage() {
  const t = useTranslations("files");

  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
    </div>
  );
}
