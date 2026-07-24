import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..", "..", "..");
const webRoot = resolve(repositoryRoot, "apps", "web");

function source(...segments) {
  return readFile(resolve(webRoot, ...segments), "utf8");
}

// T029/T031: the native bundle reuses the shared permission predicates and
// existing API adapters. Viewer restrictions therefore cannot diverge between
// the native shell and the web application.
test("Viewer cannot mutate income, expenses, or categories in the shared native bundle", async () => {
  const [permissions, incomeForm, expenseForm, categoryForm, categoryList] = await Promise.all([
    source("lib", "permissions.ts"),
    source("components", "income", "IncomeForm.tsx"),
    source("components", "expense", "ExpenseForm.tsx"),
    source("components", "category", "CategoryForm.tsx"),
    source("components", "category", "CategoryList.tsx"),
  ]);

  assert.match(permissions, /canManageIncome[\s\S]*role === "owner" \|\| role === "admin"/);
  assert.match(permissions, /canCreateExpense[\s\S]*role === "owner" \|\| role === "admin" \|\| role === "member"/);
  assert.match(permissions, /canManageCategories[\s\S]*role === "owner" \|\| role === "admin"/);
  assert.match(incomeForm, /if \(!canManageIncome\(role\)\)/);
  assert.match(expenseForm, /const allowed = canSubmit \?\? canCreateExpense\(role\)/);
  assert.match(categoryForm, /if \(!canManageCategories\(role\)\)/);
  assert.match(categoryList, /const canManage = canManageCategories\(role\)/);
});

// T031/T033: every mutable financial/category action uses the existing remote
// workspace endpoints; successful mutations only invalidate display caches.
test("financial and category mutations call existing backend endpoints rather than local financial logic", async () => {
  const [incomesApi, expensesApi, categoriesApi, incomeHooks, expenseHooks, categoryHooks] = await Promise.all([
    source("lib", "api", "incomes.ts"),
    source("lib", "api", "expenses.ts"),
    source("lib", "api", "categories.ts"),
    source("hooks", "use-incomes.ts"),
    source("hooks", "use-expenses.ts"),
    source("hooks", "use-categories.ts"),
  ]);

  for (const [api, resource] of [[incomesApi, "incomes"], [expensesApi, "expenses"]]) {
    assert.match(api, new RegExp(`apiFetch[\\s\\S]*\\/workspaces\\/\\$\\{workspaceId\\}\\/${resource}`));
    assert.match(api, /method: "POST"/);
    assert.match(api, /method: "PATCH"/);
    assert.match(api, /method: "DELETE"/);
  }
  assert.match(categoriesApi, /method: "POST"/);
  assert.match(categoriesApi, /method: "PUT"/);
  assert.match(categoriesApi, /method: "PATCH"/);
  assert.match(categoriesApi, /method: "DELETE"/);
  for (const hooks of [incomeHooks, expenseHooks]) {
    assert.match(hooks, /invalidateQueries\(\{ queryKey: \["dashboard", workspaceId\] \}\)/);
  }
  assert.match(categoryHooks, /invalidateQueries\(\{ queryKey: \["categories", workspaceId\] \}\)/);
});

// T032: both financial history screens in the packaged shared UI expose the
// same touch-friendly text/date filter. Filtering is display-only over records
// returned by the existing endpoints and never changes backend totals.
test("income and expense history expose shared mobile filtering", async () => {
  const [incomeHistory, expenseHistory, filters] = await Promise.all([
    source("components", "income", "IncomeHistoryList.tsx"),
    source("components", "expense", "ExpenseHistoryList.tsx"),
    source("components", "records", "RecordHistoryFilters.tsx"),
  ]);

  for (const history of [incomeHistory, expenseHistory]) {
    assert.match(history, /<RecordHistoryFilters value=\{filters\} onChange=\{setFilters\}/);
    assert.match(history, /filterHistoryRecords\(allRecords, filters/);
  }
  assert.match(filters, /type="search"/);
  assert.equal((filters.match(/type="date"/g) ?? []).length, 2);
  assert.doesNotMatch(filters, /apiFetch|localStorage|sessionStorage/);
});

// T035: settings receives the role and financial configuration from the
// backend workspace response and sends changes back through authenticated API
// calls. It does not write those decisions to persistent browser storage.
test("settings keep permissions and financial configuration backend-authoritative", async () => {
  const [settingsPage, workspaceApi, workspaceHooks, client, workspaceContext] = await Promise.all([
    source("app", "[locale]", "w", "[workspaceId]", "settings", "page.tsx"),
    source("lib", "api", "workspaces.ts"),
    source("hooks", "use-workspaces.ts"),
    source("lib", "api", "client.ts"),
    source("lib", "workspace-context.tsx"),
  ]);

  assert.match(workspaceApi, /role: WorkspaceRole/);
  assert.match(workspaceApi, /currency: SupportedCurrency/);
  assert.match(workspaceApi, /auto_delete_after_extraction/);
  assert.match(workspaceApi, /method: "PATCH"/);
  assert.match(settingsPage, /role=\{role\}/);
  assert.match(settingsPage, /workspaceId=\{workspaceId\}/);
  assert.match(workspaceHooks, /updateWorkspaceAutoDelete\(workspaceId/);
  assert.match(workspaceHooks, /updateWorkspaceCurrency\(workspaceId/);
  assert.match(client, /headers\.set\("Authorization", `Bearer \$\{session\.access_token\}`\)/);
  assert.doesNotMatch(settingsPage, /localStorage|sessionStorage/);
  assert.doesNotMatch(workspaceContext, /localStorage\.setItem\([^\n]*(role|currency|auto_delete)/);
});
