"use client";

import { useTranslations } from "next-intl";

import type { TrendPoint } from "@/lib/api/reports";
import { toDisplayAmount } from "@/lib/money";

type SpendingTrendChartProps = {
  points: TrendPoint[];
  locale: string;
};

function formatBucket(bucket: string, granularity: TrendPoint["granularity"], locale: string) {
  const date = new Date(`${bucket}T00:00:00Z`);
  const options: Intl.DateTimeFormatOptions =
    granularity === "month"
      ? { month: "short", timeZone: "UTC", year: "numeric" }
      : { day: "numeric", month: "short", timeZone: "UTC" };

  return new Intl.DateTimeFormat(locale, options).format(date);
}

function barWidth(value: number, maxValue: number) {
  if (value === 0) {
    return "0%";
  }

  return `${Math.max(4, (value / maxValue) * 100)}%`;
}

export function SpendingTrendChart({ points, locale }: SpendingTrendChartProps) {
  const t = useTranslations("reports.trend");
  const dashboard = useTranslations("dashboard");
  const maxValue = Math.max(
    1,
    ...points.flatMap((point) => [point.income_minor, point.expense_minor, Math.abs(point.remaining_minor)]),
  );

  return (
    <section className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      {points.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {points.map((point) => {
            const incomeWidth = barWidth(point.income_minor, maxValue);
            const expenseWidth = barWidth(point.expense_minor, maxValue);
            const remainingWidth = barWidth(Math.abs(point.remaining_minor), maxValue);

            return (
              <article className="space-y-2" key={`${point.granularity}-${point.bucket}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {formatBucket(point.bucket, point.granularity, locale)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {toDisplayAmount(point.remaining_minor, locale)}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-[7.5rem_1fr] items-center gap-3">
                    <span className="text-xs text-muted-foreground">{dashboard("totalIncome")}</span>
                    <span className="h-2 rounded-sm bg-muted">
                      <span className="block h-2 rounded-sm bg-emerald-500" style={{ width: incomeWidth }} />
                    </span>
                  </div>
                  <div className="grid grid-cols-[7.5rem_1fr] items-center gap-3">
                    <span className="text-xs text-muted-foreground">{dashboard("totalExpenses")}</span>
                    <span className="h-2 rounded-sm bg-muted">
                      <span className="block h-2 rounded-sm bg-rose-500" style={{ width: expenseWidth }} />
                    </span>
                  </div>
                  <div className="grid grid-cols-[7.5rem_1fr] items-center gap-3">
                    <span className="text-xs text-muted-foreground">{dashboard("remainingBalance")}</span>
                    <span className="h-2 rounded-sm bg-muted">
                      <span
                        className={
                          point.remaining_minor < 0
                            ? "block h-2 rounded-sm bg-destructive"
                            : "block h-2 rounded-sm bg-sky-500"
                        }
                        style={{ width: remainingWidth }}
                      />
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
