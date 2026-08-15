import type { Page, Route } from "@playwright/test";

import type { DashboardResponse } from "@/lib/api/dashboard";
import type { ReportResponse } from "@/lib/api/reports";

/**
 * The committed visual baselines were captured while the server's reporting
 * window was July 2026, and the dashboard renders that window as literal text
 * ("Current period: 2026-07-01 to 2026-07-31").
 *
 * That window is decided by the **server** — `apps/api/app/services/dashboard.py`
 * `get_current_period()` reads `datetime.now(UTC+3)` — and
 * `GET /workspaces/{id}/dashboard` accepts no period argument. The spec's
 * `page.clock.setFixedTime` only moves the *browser* clock, so it cannot pin the
 * server window: from August 2026 onward the real response drifts and the
 * baseline can never match again. Re-capturing the baselines would only re-freeze
 * whatever month the capture happened in and break again the following month.
 *
 * So the visual spec pins the one date-sensitive response it captures, rather
 * than the whole application: this intercepts only the dashboard request, takes
 * the **real** response so the shape and every unrelated field stay authentic,
 * and overwrites just the period and the fields the server derives from it.
 * The result no longer depends on the real month or year.
 */

/** The window the committed baselines were captured in. */
export const VISUAL_PERIOD = { start: "2026-07-01", end: "2026-07-31" } as const;

/** Matches `seedIncome`'s default record, which the baselines were captured with. */
const SEEDED_INCOME_MINOR = 125_000;
const SEEDED_INCOME_DATE = "2026-07-13";
const SEEDED_INCOME_DESCRIPTION = "RTL regression income";
// Stable placeholder: the dashboard never renders a record id, but the field is
// part of the response contract, so it must be present and must not vary.
const SEEDED_INCOME_ID = "00000000-0000-4000-8000-0000000000f1";

/**
 * Pin the dashboard response to the fixed July 2026 scenario the baselines show.
 *
 * `seededWorkspaceId` is the workspace `seedIncome` was called for — it renders
 * the populated state. Every other workspace (the spec's deliberately empty one)
 * keeps the zeroed state. Register before the first dashboard navigation.
 */
export async function pinDashboardPeriod(page: Page, seededWorkspaceId: string) {
  await page.route("**/workspaces/*/dashboard*", async (route: Route) => {
    const response = await route.fetch();
    if (!response.ok()) {
      // Let a genuine backend failure surface as itself rather than masking it
      // behind a synthetic success.
      await route.fulfill({ response });
      return;
    }

    const real = (await response.json()) as DashboardResponse;
    const isSeeded = real.workspace_id === seededWorkspaceId;
    const currency = real.summary.currency;

    const pinned: DashboardResponse = {
      ...real,
      period: { ...VISUAL_PERIOD },
      summary: {
        total_income_minor: isSeeded ? SEEDED_INCOME_MINOR : 0,
        total_expenses_minor: 0,
        remaining_balance_minor: isSeeded ? SEEDED_INCOME_MINOR : 0,
        currency,
      },
      // The dashboard breakdown covers expenses only, and neither workspace is
      // seeded with one, so this is empty in both the baseline and here.
      category_breakdown: [],
      recent_records: isSeeded
        ? [
            {
              type: "income",
              id: SEEDED_INCOME_ID,
              amount_minor: SEEDED_INCOME_MINOR,
              currency,
              occurred_on: SEEDED_INCOME_DATE,
              description: SEEDED_INCOME_DESCRIPTION,
              merchant_name: null,
              category_id: null,
            },
          ]
        : [],
    };

    await route.fulfill({
      response,
      contentType: "application/json",
      body: JSON.stringify(pinned),
    });
  });
}

/**
 * Pin the reports response to the same fixed July 2026 scenario.
 *
 * `GET /workspaces/{id}/reports` resolves its window from the *server's* clock
 * (`apps/api/app/services/reports.py` `resolve_report_period`) just as the
 * dashboard does, and the reports page renders those dates as literal text in
 * both its subheading and its period KPI card. Reports is in fact strictly more
 * date-sensitive than the dashboard, in two ways the period text alone does not
 * show:
 *
 *   - `get_team_activity` filters on `created_at` — the real insert time — so a
 *     record seeded during the run counts only while the wall clock happens to
 *     fall inside the reported window.
 *   - `seedIncome`'s record is dated 2026-07-13, so from August 2026 onward it
 *     leaves the current month altogether and the page flips from its populated
 *     layout to its empty one.
 *
 * The values below are not invented. They are the response this endpoint really
 * returned for the seeded workspace when queried for 2026-07-01..2026-07-31;
 * `workspace_id` and `currency` are still taken from the live response so the
 * envelope and the workspace's own currency stay authentic. Typing the literal
 * as `ReportResponse` is deliberate: if the contract gains or changes a field,
 * this stops compiling instead of silently pinning a stale shape.
 *
 * Deliberately does not share a record-builder with `pinDashboardPeriod` above:
 * that helper backs already-approved baselines, and leaving it untouched keeps
 * this change incapable of moving them.
 *
 * Register before the first reports navigation.
 */
export async function pinReportsPeriod(page: Page, seededWorkspaceId: string) {
  await page.route("**/workspaces/*/reports*", async (route: Route) => {
    const response = await route.fetch();
    if (!response.ok()) {
      // Let a genuine backend failure surface as itself rather than masking it
      // behind a synthetic success.
      await route.fulfill({ response });
      return;
    }

    const real = (await response.json()) as ReportResponse;
    const isSeeded = real.workspace_id === seededWorkspaceId;
    const currency = real.summary.currency;
    const income = isSeeded ? SEEDED_INCOME_MINOR : 0;

    const pinned: ReportResponse = {
      ...real,
      // `current_month` keeps the heading on its "Current month: …" wording,
      // which is what the page's default period selection renders.
      period: { preset: "current_month", ...VISUAL_PERIOD },
      summary: {
        total_income_minor: income,
        total_expenses_minor: 0,
        remaining_balance_minor: income,
        currency,
      },
      // No expense is ever seeded, so the expense-side breakdown and the
      // merchant list are empty in every scenario this spec captures.
      category_breakdown: [],
      top_merchants: [],
      // The seeded income carries no category, which the API reports as a
      // single "Uncategorized" row rather than an empty list.
      income_category_breakdown: isSeeded
        ? [{ category_id: null, category_name: "Uncategorized", total_minor: income, currency }]
        : [],
      spending_trend: isSeeded
        ? [
            {
              bucket: SEEDED_INCOME_DATE,
              granularity: "day",
              income_minor: income,
              expense_minor: 0,
              remaining_minor: income,
              currency,
            },
          ]
        : [],
      recent_records: isSeeded
        ? [
            {
              type: "income",
              id: SEEDED_INCOME_ID,
              amount_minor: income,
              currency,
              occurred_on: SEEDED_INCOME_DATE,
              description: SEEDED_INCOME_DESCRIPTION,
              merchant_name: null,
              category_id: null,
            },
          ]
        : [],
      // Empty for the seeded workspace too: team activity is keyed on
      // `created_at`, so anything else here would track the wall clock rather
      // than the fixture.
      team_activity: [],
      pending_review_count: 0,
      spending_summary: {
        total_income_minor: income,
        total_expenses_minor: 0,
        remaining_balance_minor: income,
        top_category: null,
        trend_direction: "flat",
        currency,
      },
    };

    await route.fulfill({
      response,
      contentType: "application/json",
      body: JSON.stringify(pinned),
    });
  });
}
