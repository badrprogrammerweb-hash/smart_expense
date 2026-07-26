import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..", "..", "..");
const webRoot = resolve(repositoryRoot, "apps", "web");

function source(...segments) {
  return readFile(resolve(webRoot, ...segments), "utf8");
}

// T028/T030: Capacitor packages this same UI, so this contract verifies that
// the native shell displays every dashboard value supplied by the existing
// backend endpoint. It intentionally does not duplicate financial arithmetic
// in the mobile project.
test("dashboard renders the backend summary, period, categories, records, and pending-review count", async () => {
  const [dashboardApi, dashboardPage, summaryCards, recentActivity, categoryBreakdown] = await Promise.all([
    source("lib", "api", "dashboard.ts"),
    source("app", "[locale]", "w", "[workspaceId]", "dashboard", "page.tsx"),
    source("components", "dashboard", "SummaryCards.tsx"),
    source("components", "dashboard", "RecentActivity.tsx"),
    source("components", "dashboard", "CategoryBreakdown.tsx"),
  ]);

  assert.match(dashboardApi, /apiFetch<DashboardResponse>/);
  assert.match(dashboardApi, /\/workspaces\/\$\{workspaceId\}\/dashboard/);
  for (const field of ["total_income_minor", "total_expenses_minor", "remaining_balance_minor", "period", "category_breakdown", "recent_records", "pending_ai_count"]) {
    assert.match(dashboardApi, new RegExp(field));
  }
  assert.match(dashboardPage, /<SummaryCards locale=\{locale\} period=\{data\.period\} summary=\{data\.summary\}/);
  assert.match(dashboardPage, /items=\{data\.category_breakdown\}/);
  assert.match(dashboardPage, /records=\{data\.recent_records\}/);
  assert.match(dashboardPage, /pendingAiCount=\{data\.pending_ai_count\}/);
  assert.match(summaryCards, /summary\.remaining_balance_minor/);
  assert.match(summaryCards, /period\.start.*period\.end/s);
  assert.match(recentActivity, /pendingAiCount/);
  assert.match(categoryBreakdown, /item\.total_minor/);
});

// T028/T034: report summaries use the same backend-shaped DashboardSummary as
// the dashboard and pass the selected period verbatim to the existing reports
// endpoint. No mobile-side total is derived from records or category rows.
test("reports reuse backend totals and send the selected workspace period to the existing endpoint", async () => {
  const [reportsApi, reportSummary, reportsHook] = await Promise.all([
    source("lib", "api", "reports.ts"),
    source("components", "reports", "ReportSummary.tsx"),
    source("hooks", "use-reports.ts"),
  ]);

  assert.match(reportsApi, /summary: DashboardSummary/);
  assert.match(reportsApi, /apiFetch<ReportResponse>/);
  assert.match(reportsApi, /\/workspaces\/\$\{workspaceId\}\/reports\?\$\{params\.toString\(\)\}/);
  assert.match(reportsApi, /new URLSearchParams\(\{ period: period\.period \}\)/);
  assert.match(reportSummary, /<SummaryCards locale=\{locale\} period=\{data\.period\} summary=\{data\.summary\}/);
  assert.match(reportSummary, /<PeriodSelector onChange=\{reports\.setPeriod\} value=\{reports\.period\}/);
  assert.match(reportSummary, /items=\{data\.category_breakdown\}/);
  assert.match(reportsHook, /queryFn: \(\) => getReport\(workspaceId, period\)/);
});
