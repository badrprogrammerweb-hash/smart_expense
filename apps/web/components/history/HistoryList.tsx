"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";

import type { ActivityHistoryItem } from "@/lib/api/history";

type HistoryListProps = {
  items: ActivityHistoryItem[];
  locale: string;
};

function formatTimestamp(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function summaryText(summary: Record<string, unknown>) {
  const merchantName = summary.merchant_name;
  const name = summary.name;
  const setting = summary.setting;
  const provider = summary.provider;

  if (typeof merchantName === "string" && merchantName.trim()) {
    return merchantName;
  }
  if (typeof name === "string" && name.trim()) {
    return name;
  }
  if (typeof setting === "string" && setting.trim()) {
    return setting;
  }
  if (typeof provider === "string" && provider.trim()) {
    return provider;
  }
  return null;
}

export function HistoryList({ items, locale }: HistoryListProps) {
  const t = useTranslations("history");
  const events = useTranslations("history.events");

  return (
    <section className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <ul className="divide-y">
        {items.map((item) => {
          const detail = summaryText(item.summary);

          return (
            <li className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between" key={item.id}>
              <div className="min-w-0">
                <p className="text-sm font-medium">{events(item.event_type)}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {item.actor_display_name ?? t("unknownActor")}
                  {detail ? ` - ${detail}` : ""}
                </p>
              </div>
              <p className="inline-flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {formatTimestamp(item.created_at, locale)}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
