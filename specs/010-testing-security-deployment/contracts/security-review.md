# Contract: Security Review Document (structure)

Authoritative outline for `specs/010-testing-security-deployment/security-review.md`
(the living deliverable created in tasks). Check schema is E2 in `data-model.md`.
Every `FAIL` links to a findings-register row (E1).

## Header

- Scope: the assembled Phases 2–9 MVP (backend `apps/api`, frontend `apps/web`,
  Supabase Postgres/Auth/Vault/Storage).
- Method: checklist-driven manual review cross-referenced to the automated acceptance
  suite; **internal review, not a third-party audit or penetration test** (out of
  scope, FR-034).
- Date, reviewer, commit reviewed.

## Section VI — Privacy & Security (principle VI)

Mandatory checks (each: statement, verdict, evidence/test ref, finding on FAIL):

- `SR-VI-01` Workspace-based tenant isolation enforced for tenant-owned data.
- `SR-VI-02` Role-based permissions enforced on the backend for every protected
  action (not frontend-only).
- `SR-VI-03` File storage is private by default; no public URLs for financial
  documents.
- `SR-VI-04` BYOK AI key stored in Supabase Vault; never exposed to the frontend.
- `SR-VI-05` AI key never appears in API responses, logs, or error messages.
- `SR-VI-06` No sensitive data (keys, tokens, financial PII) in logs or error text.
- `SR-VI-07` Supabase RLS enabled for tenant-owned tables.
- Cross-reference: `test_acc_ai_behavior.py`, `test_acc_file_privacy.py`,
  `test_extraction_secrecy.py`, `test_storage_error_sanitization.py`.

## Section VII — Multi-Tenant Isolation (principle VII)

- `SR-VII-01` No cross-workspace read for income/expenses/categories/files/reports/
  history.
- `SR-VII-02` No cross-workspace write.
- `SR-VII-03` Unauthenticated requests to protected resources denied.
- `SR-VII-04` Viewer role cannot modify any workspace record.
- `SR-VII-05` Every business record is workspace-scoped.
- Cross-reference: `test_acc_tenant_isolation.py`, `test_acc_role_permissions.py`,
  `test_workspace_isolation.py`, `test_files_isolation.py`, `test_reports_isolation.py`,
  `test_history_access.py`.

## Section IX — Architecture Authority (principle IX)

- `SR-IX-01` Financial calculations owned by the backend; frontend is display-only.
- `SR-IX-02` Authorization/role validation performed on the backend/database, not the
  frontend.
- `SR-IX-03` Supabase Postgres is the source of truth; frontend cannot override
  backend/DB truth.
- Cross-reference: `test_acc_financial_accuracy.py`, `test_acc_role_permissions.py`,
  `test_reports_reconciliation.py`.

## Section X — Financial Accuracy (principle X, NON-NEGOTIABLE)

- `SR-X-01` Money stored/computed as integer minor units; no floating-point money.
- `SR-X-02` Remaining balance = confirmed income − confirmed expenses, always.
- `SR-X-03` Draft/pending/failed/unconfirmed AI records never affect totals.
- `SR-X-04` Edits/deletes immediately recalculate totals; deleted records excluded.
- `SR-X-05` Constitution-required financial edge states are all tested.
- Cross-reference: `test_acc_financial_accuracy.py`, `test_extraction_totals.py`,
  `test_income_expense_edit_delete.py`.

## Findings summary

- Table of all `FAIL` checks → finding ids.
- Count by severity and area.
- List of release-blocker findings (Critical/High in financial-accuracy or
  tenant-isolation) or "none".

## Coverage rule (SC-008)

100% of the four in-scope principles are covered with at least the mandatory checks
above; each `FAIL` has a `finding_ref`. Where an automated test backs a check, it is
cited so the review is test-evidenced, not narrative-only.
