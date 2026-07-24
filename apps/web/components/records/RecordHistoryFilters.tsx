"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui";

export type HistoryFilterState = {
  query: string;
  start: string;
  end: string;
};

export const EMPTY_HISTORY_FILTERS: HistoryFilterState = {
  query: "",
  start: "",
  end: "",
};

type DatedRecord = {
  occurred_on: string;
};

export function filterHistoryRecords<T extends DatedRecord>(
  records: T[],
  filters: HistoryFilterState,
  searchableValues: (record: T) => Array<string | null | undefined>,
) {
  const query = filters.query.trim().toLocaleLowerCase();

  return records.filter((record) => {
    if (filters.start && record.occurred_on < filters.start) return false;
    if (filters.end && record.occurred_on > filters.end) return false;
    if (!query) return true;

    return searchableValues(record).some((value) =>
      value?.toLocaleLowerCase().includes(query),
    );
  });
}

export function RecordHistoryFilters({
  value,
  onChange,
}: {
  value: HistoryFilterState;
  onChange: (value: HistoryFilterState) => void;
}) {
  const t = useTranslations("records.filters");
  const hasFilters = Boolean(value.query || value.start || value.end);

  return (
    <div
      aria-label={t("label")}
      className="grid gap-3 rounded-[var(--radius-card)] border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_auto_auto_auto] lg:items-end"
      role="group"
    >
      <label className="text-sm font-medium">
        {t("search")}
        <span className="relative mt-1 block">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="min-h-11 w-full rounded-md border bg-background py-2 pe-3 ps-10 text-sm"
            onChange={(event) => onChange({ ...value, query: event.currentTarget.value })}
            placeholder={t("searchPlaceholder")}
            type="search"
            value={value.query}
          />
        </span>
      </label>
      <label className="text-sm font-medium">
        {t("from")}
        <input
          className="mt-1 block min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm"
          dir="ltr"
          onChange={(event) => onChange({ ...value, start: event.currentTarget.value })}
          type="date"
          value={value.start}
        />
      </label>
      <label className="text-sm font-medium">
        {t("to")}
        <input
          className="mt-1 block min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm"
          dir="ltr"
          onChange={(event) => onChange({ ...value, end: event.currentTarget.value })}
          type="date"
          value={value.end}
        />
      </label>
      <Button
        disabled={!hasFilters}
        onClick={() => onChange({ ...EMPTY_HISTORY_FILTERS })}
        type="button"
        variant="secondary"
      >
        <X aria-hidden="true" className="size-4" />
        {t("clear")}
      </Button>
    </div>
  );
}
