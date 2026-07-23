import { getTranslations } from "next-intl/server";

export default async function OfflinePage() {
  const t = await getTranslations("pwa.offline");
  return <main className="full-height-dvh grid place-items-center bg-background p-6"><section className="max-w-md rounded-[var(--radius-card)] border bg-card p-6 text-center shadow-[var(--shadow-card)]" role="status"><h1 className="text-xl font-semibold">{t("title")}</h1><p className="mt-2 text-muted-foreground">{t("description")}</p><p className="mt-3 text-sm text-muted-foreground">{t("mutationsDisabled")}</p></section></main>;
}
