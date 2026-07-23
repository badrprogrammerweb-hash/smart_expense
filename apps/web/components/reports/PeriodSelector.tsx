"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";

import type { ReportPeriodInput, ReportPeriodPreset } from "@/lib/api/reports";
import { DateDisplay } from "@/components/ui";

type PeriodSelectorProps = {
  value: ReportPeriodInput;
  onChange: (period: ReportPeriodInput) => void;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return Number.NaN;
  }

  return Math.floor((endTime - startTime) / 86_400_000) + 1;
}

function customDates(value: ReportPeriodInput) {
  if (value.period === "custom") {
    return { start: value.start, end: value.end };
  }

  const fallback = todayIso();
  return { start: fallback, end: fallback };
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const t = useTranslations("reports.periodSelector");
  const [start, setStart] = useState(customDates(value).start);
  const [end, setEnd] = useState(customDates(value).end);

  useEffect(() => {
    const dates = customDates(value);
    setStart(dates.start);
    setEnd(dates.end);
  }, [value]);

  const validationError = useMemo(() => {
    const span = daysBetween(start, end);

    if (Number.isNaN(span) || span <= 0) {
      return t("invalidRange");
    }

    if (span > 366) {
      return t("rangeTooLarge");
    }

    return null;
  }, [end, start, t]);

  function selectPreset(period: ReportPeriodPreset) {
    if (period === "custom") {
      if (!validationError) {
        onChange({ period, start, end });
      }
      return;
    }

    onChange({ period });
  }

  function applyCustom() {
    if (!validationError) {
      onChange({ period: "custom", start, end });
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border bg-card p-4 text-card-foreground shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span>{t("label")}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t("label")}>
            {(["current_month", "previous_month"] as const).map((preset) => (
              <button
                className={
                  value.period === preset
                    ? "min-h-11 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                    : "min-h-11 rounded-md border px-3 py-2 text-sm font-medium"
                }
                key={preset}
                onClick={() => selectPreset(preset)}
                type="button"
              >
                {t(preset)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm font-medium">
            {t("start")}
            <input
              className="mt-1 block min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm"
              onChange={(event) => setStart(event.target.value)}
              dir="ltr"
              type="date"
              value={start}
            />
            {start ? <DateDisplay date={start} className="mt-1 text-xs text-muted-foreground" /> : null}
          </label>
          <label className="text-sm font-medium">
            {t("end")}
            <input
              className="mt-1 block min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm"
              onChange={(event) => setEnd(event.target.value)}
              dir="ltr"
              type="date"
              value={end}
            />
            {end ? <DateDisplay date={end} className="mt-1 text-xs text-muted-foreground" /> : null}
          </label>
          <button
            className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            disabled={Boolean(validationError)}
            onClick={applyCustom}
            type="button"
          >
            {t("applyCustom")}
          </button>
        </div>
      </div>
      {validationError && <p className="mt-3 text-sm text-destructive">{validationError}</p>}
    </section>
  );
}
