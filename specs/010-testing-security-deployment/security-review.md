# Security Review

## Header

| Field | Value |
|-------|-------|
| Scope | Assembled Phases 2-9 MVP: backend `apps/api`, frontend `apps/web`, Supabase Postgres/Auth/Vault/Storage. |
| Method | Checklist-driven internal manual review cross-referenced to automated backend tests and Phase 10 acceptance tests; not a third-party audit or penetration test. |
| Date | 2026-07-11 |
| Reviewer | Codex |
| Commit reviewed | `dc0decb` plus working-tree Phase 10 artifacts through T035. |

## Section VI - Privacy & Security

| Check ID | Statement | Verdict | Evidence/Test Ref | Finding Ref |
|----------|-----------|---------|-------------------|-------------|
| SR-VI-01 | Workspace-based tenant isolation enforced for tenant-owned data. | PASS | `test_acc_tenant_isolation.py::test_cross_workspace_read_denied_all_record_types`; `test_workspace_isolation.py::test_non_member_workspace_detail_returns_same_404_shape_as_missing_workspace`; `test_files_isolation.py::test_file_operations_return_not_found_for_another_workspace_file`; `test_reports_isolation.py::test_reports_are_readable_by_workspace_roles_but_not_outsiders`; `test_history_access.py::test_history_access_pagination_and_isolation`. | None |
| SR-VI-02 | Role-based permissions enforced on the backend for every protected action, not frontend-only. | PASS | Backend routes/services call `get_current_user`, `get_rls_session` or `open_rls_session`, then check workspace role before mutation; covered by `test_extraction_authorization.py`, `test_ai_settings_authorization.py`, `test_files_upload.py::test_upload_rejects_viewer_role`, `test_income_expense_edit_delete.py::test_income_and_expense_edit_delete_permissions`; `test_acc_role_permissions.py::test_owner_admin_member_viewer_action_matrix`. | None |
| SR-VI-03 | File storage is private by default; no public URLs for financial documents. | PASS | `app.services.storage` exposes private Supabase object operations and signed download URLs, not public object URLs; `test_files_access_privacy.py::test_members_can_list_and_get_short_lived_download_url`; `test_files_access_privacy.py::test_non_member_and_anonymous_callers_do_not_receive_private_access`; `test_files_isolation.py::test_file_operations_return_not_found_for_another_workspace_file`; `test_acc_file_privacy.py::test_files_private_no_public_url`; `test_acc_file_privacy.py::test_file_access_scoped_to_membership`. | None |
| SR-VI-04 | BYOK AI key stored in Supabase Vault; never exposed to the frontend. | PASS | `test_ai_settings_secrecy.py::test_raw_key_never_appears_in_responses_logs_or_app_table`; `test_extraction_secrecy.py::test_only_key_read_rpc_function_ever_queries_vault_decrypted_secrets`; code review of `app.services.ai_settings` and `app.services.extractions` shows key access through Vault-backed RPCs only. | None |
| SR-VI-05 | AI key never appears in API responses, logs, or error messages. | PASS | `test_extraction_secrecy.py::test_key_never_appears_in_trigger_confirm_or_discard_responses_or_logs`; `test_extraction_secrecy.py::test_forbidden_key_read_attempt_never_exposes_the_key_either`; `test_ai_settings_secrecy.py::test_raw_key_never_appears_in_responses_logs_or_app_table`; `test_ai_summary_error_handling.py::test_invalid_key_and_provider_failure_return_safe_errors_without_breaking_report`; `test_acc_ai_behavior.py::test_byok_key_never_in_response_log_or_error`. | None |
| SR-VI-06 | No sensitive data such as keys, tokens, or financial PII in logs or error text. | PASS | `app.core.logging.SensitiveDataFilter` redacts bearer tokens, key-like values, and passwords; `app.core.auth._sanitized_db_error` redacts database URLs, passwords, bearer tokens, and JWTs; `test_storage_error_sanitization.py::test_storage_response_errors_redact_service_role_key`; extraction secrecy tests capture logs and assert raw keys are absent. | None |
| SR-VI-07 | Supabase RLS enabled for tenant-owned tables. | PASS | Migrations enable RLS on `workspaces`, `workspace_memberships`, `categories`, `incomes`, `expenses`, `files`, `workspace_ai_settings`, `ai_extractions`, and `activity_history`; route tests above exercise those policies through real local Auth/RLS sessions. | None |

## Section VII - Multi-Tenant Isolation

| Check ID | Statement | Verdict | Evidence/Test Ref | Finding Ref |
|----------|-----------|---------|-------------------|-------------|
| SR-VII-01 | No cross-workspace read for income, expenses, categories, files, reports, or history. | PASS | `test_acc_tenant_isolation.py::test_cross_workspace_read_denied_all_record_types`; `test_files_isolation.py::test_file_operations_return_not_found_for_another_workspace_file`; `test_reports_isolation.py::test_reports_are_readable_by_workspace_roles_but_not_outsiders`; `test_history_access.py::test_history_access_pagination_and_isolation`. | None |
| SR-VII-02 | No cross-workspace write. | PASS | `test_acc_tenant_isolation.py::test_cross_workspace_write_denied`; existing route/service review confirms write paths first resolve workspace membership or execute under RLS. | None |
| SR-VII-03 | Unauthenticated requests to protected resources denied. | PASS | `test_acc_tenant_isolation.py::test_unauthenticated_requests_denied`; `test_reports_isolation.py::test_reports_are_readable_by_workspace_roles_but_not_outsiders`; file privacy tests include anonymous denial. | None |
| SR-VII-04 | Viewer role cannot modify any workspace record. | PASS | Backend review of income/category/settings/files/extraction routes shows viewers excluded from mutation role sets; covered by `test_extraction_authorization.py::test_viewer_can_view_everywhere_but_cannot_act_anywhere`, `test_files_upload.py::test_upload_rejects_viewer_role`, and `test_income_expense_edit_delete.py::test_income_and_expense_edit_delete_permissions`; `test_acc_role_permissions.py::test_viewer_cannot_modify_any_record`. | None |
| SR-VII-05 | Every business record is workspace-scoped. | PASS | Schema/migration review confirms workspace ownership columns on workspaces, memberships, categories, incomes, expenses, files, AI settings/extractions, reports query inputs, and activity history; cross-workspace tests above exercise read/write scoping on the exposed surfaces. | None |

## Section IX - Architecture Authority

| Check ID | Statement | Verdict | Evidence/Test Ref | Finding Ref |
|----------|-----------|---------|-------------------|-------------|
| SR-IX-01 | Financial calculations owned by the backend; frontend is display-only. | PASS | `app.services.dashboard` owns current-period totals; `app.services.reports` reuses dashboard functions for overlapping report figures; `test_acc_financial_accuracy.py`; `test_reports_reconciliation.py::test_report_summary_reconciles_with_dashboard_for_equivalent_current_period`. | None |
| SR-IX-02 | Authorization and role validation performed on the backend/database, not the frontend. | PASS | Protected FastAPI routes require `get_current_user` and RLS sessions, then enforce workspace role checks; `test_acc_tenant_isolation.py::test_isolation_enforced_at_backend_or_rls_not_frontend` sends direct backend requests and verifies denial before upload-body parsing; `test_acc_role_permissions.py::test_owner_admin_member_viewer_action_matrix`. | None |
| SR-IX-03 | Supabase Postgres is the source of truth; frontend cannot override backend/DB truth. | PASS | Financial records, AI extraction confirmation, activity history triggers, and report aggregates are persisted/computed through Postgres-backed services/RPCs; `test_acc_readiness_smoke.py::test_confirmed_only_reconciliation_smoke_create_confirm_report_equals_dashboard`; `test_reports_reconciliation.py::test_report_summary_reconciles_with_dashboard_for_equivalent_current_period`; `test_history_triggers.py`. | None |

## Section X - Financial Accuracy

| Check ID | Statement | Verdict | Evidence/Test Ref | Finding Ref |
|----------|-----------|---------|-------------------|-------------|
| SR-X-01 | Money stored and computed as integer minor units; no floating-point money. | PASS | `test_acc_financial_accuracy.py::test_money_is_integer_minor_units_no_float_drift`; schemas/services use `amount_minor` integer fields and SQL integer sums for income/expense/report totals. | None |
| SR-X-02 | Remaining balance equals confirmed income minus confirmed expenses, always. | PASS | `test_acc_financial_accuracy.py::test_remaining_balance_equals_confirmed_income_minus_expenses`; `test_reports_reconciliation.py::test_report_summary_reconciles_with_dashboard_for_equivalent_current_period`; dashboard/report services compute `remaining_balance_minor = total_income_minor - total_expenses_minor`. | None |
| SR-X-03 | Draft, pending, failed, or unconfirmed AI records never affect totals. | PASS | `test_acc_financial_accuracy.py::test_draft_pending_failed_ai_move_zero_totals`; `test_extraction_totals.py::test_unconfirmed_extractions_do_not_affect_dashboard_or_report_figures`; `test_reports_confirmed_only.py::test_report_figures_exclude_deleted_records_and_unconfirmed_ai_rows`. | None |
| SR-X-04 | Edits and deletes immediately recalculate totals; deleted records are excluded. | PASS | `test_acc_financial_accuracy.py::test_edit_and_delete_recalculate_totals`; `test_income_expense_edit_delete.py::test_edit_delete_updates_confirmed_sums_and_soft_deleted_rows`; `test_dashboard_summary.py::test_dashboard_summary_excludes_deleted_expenses`; `test_dashboard_summary.py::test_dashboard_summary_excludes_deleted_incomes`. | None |
| SR-X-05 | Constitution-required financial edge states are all tested. | PASS | `test_acc_financial_accuracy.py::test_zero_income_zero_expense_negative_balance`; `test_acc_financial_accuracy.py::test_multi_workspace_totals_are_independent`; `test_dashboard_summary.py::test_dashboard_summary_returns_zero_totals_for_empty_workspace`; `test_dashboard_summary.py::test_dashboard_summary_returns_signed_negative_balance`. | None |

## Findings Summary

| Failed Check | Finding ID | Severity | Area |
|--------------|------------|----------|------|
| None | None | None | None |

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |

| Area | Count |
|------|-------|
| financial-accuracy | 0 |
| tenant-isolation | 0 |
| role-permissions | 0 |
| file-privacy | 0 |
| ai-behavior | 0 |
| localization | 0 |
| deployment | 0 |
| other | 0 |

Release-blocker findings: none.

Coverage rule (SC-008): PASS. Sections VI, VII, IX, and X all contain verdicts and evidence for every mandatory check; no FAIL checks were found in these four principles, so no findings-register rows are required from this document. (`findings-register.md` separately tracks one unrelated Low-severity localization finding, F-001, surfaced by the Phase 10 US5 manual RTL checklist — it does not affect any Section VI/VII/IX/X verdict.)
