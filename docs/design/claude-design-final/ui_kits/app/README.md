# Smart Expense — App UI Kit

Interactive click-through recreation of the product's existing frontend surfaces, per the design brief (Section 6). Open `index.html`.

**Flow:** sign-in → dashboard → sidebar navigation between income/expenses/categories/files/AI review/reports/history/settings. Add-expense/add-income open `RecordFormDialog`; deleting opens `ConfirmDialog`; AI review lets you edit extracted fields and confirm/discard; settings has general/AI-provider/members tabs.

**Demo controls** (floating bottom-start button, not part of the product): switch role (Owner/Admin/Member/Viewer) to see permission-based UI change, toggle an empty first-run workspace, a loading state, and an error state on Reports.

**Files:** `mock-data.js` (Arabic sample data), `AuthScreen`, `DashboardScreen`, `RecordsScreen` (shared income/expense), `RecordFormDialog`, `CategoriesScreen`, `FilesScreen`, `AIReviewScreen`, `ReportsScreen`, `HistoryScreen`, `WorkspaceMembersScreen`, `SettingsScreen`. All compose primitives from `components/` — no re-implemented buttons/inputs/tables.

Responsive: below 1024px the sidebar is replaced by `MobileNav` and tables collapse to `MobileRecordCard` stacks (see the `<style>` block in `index.html`).
