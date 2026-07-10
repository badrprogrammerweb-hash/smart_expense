# Contract: Test Coverage Matrix

Authoritative mapping of every constitution testing area + requirement to the
concrete verifier the tasks must produce. `tasks.md` derives its test tasks from this
matrix; `/speckit-analyze` uses it to confirm no required guarantee is left without a
verifier. Row schema is E3 in `data-model.md`.

Tiers: `backend-integration` (pytest, `apps/api/tests/acceptance/`), `frontend-e2e`
(Playwright, `apps/web/e2e/`), `frontend-unit` (Vitest, `apps/web/tests/unit/`),
`manual` (checklist).

| Area | Requirement(s) | Verifier | Tier | Status |
|------|----------------|----------|------|--------|
| financial-accuracy | FR-004, SC-001 | `test_acc_financial_accuracy.py::test_remaining_balance_equals_confirmed_income_minus_expenses` | backend-integration | passing |
| financial-accuracy | FR-007, SC-001 | `test_acc_financial_accuracy.py::test_zero_income_zero_expense_negative_balance` | backend-integration | passing |
| financial-accuracy | FR-006 | `test_acc_financial_accuracy.py::test_edit_and_delete_recalculate_totals` | backend-integration | passing |
| financial-accuracy | FR-005, FR-018 | `test_acc_financial_accuracy.py::test_draft_pending_failed_ai_move_zero_totals` | backend-integration | passing |
| financial-accuracy | FR-008 | `test_acc_financial_accuracy.py::test_money_is_integer_minor_units_no_float_drift` | backend-integration | passing |
| financial-accuracy | FR-007 | `test_acc_financial_accuracy.py::test_multi_workspace_totals_are_independent` | backend-integration | passing |
| tenant-isolation | FR-009, SC-002 | `test_acc_tenant_isolation.py::test_cross_workspace_read_denied_all_record_types` | backend-integration | passing |
| tenant-isolation | FR-010, SC-002 | `test_acc_tenant_isolation.py::test_cross_workspace_write_denied` | backend-integration | passing |
| tenant-isolation | FR-011, SC-002 | `test_acc_tenant_isolation.py::test_unauthenticated_requests_denied` | backend-integration | passing |
| tenant-isolation | FR-012 | `test_acc_tenant_isolation.py::test_isolation_enforced_at_backend_or_rls_not_frontend` | backend-integration | passing |
| role-permissions | FR-013, SC-003 | `test_acc_role_permissions.py::test_owner_admin_member_viewer_action_matrix` | backend-integration | passing |
| role-permissions | FR-014, SC-003 | `test_acc_role_permissions.py::test_viewer_cannot_modify_any_record` | backend-integration | passing |
| role-permissions | FR-013 | `acc-role-permissions.spec.ts` (UI surfaces gate by role) | frontend-e2e | passing |
| file-privacy | FR-015, SC-004 | `test_acc_file_privacy.py::test_files_private_no_public_url` | backend-integration | passing |
| file-privacy | FR-016, SC-004 | `test_acc_file_privacy.py::test_file_access_scoped_to_membership` | backend-integration | passing |
| file-privacy | FR-015 | `acc-file-privacy.spec.ts` (no public file URL surfaced) | frontend-e2e | passing |
| ai-behavior | FR-017, SC-005 | `test_acc_ai_behavior.py::test_byok_key_never_in_response_log_or_error` | backend-integration | passing |
| ai-behavior | FR-018, SC-005 | `test_acc_ai_behavior.py::test_unconfirmed_ai_moves_zero_totals` | backend-integration | passing |
| ai-behavior | FR-019 | `test_acc_ai_behavior.py::test_provider_error_and_invalid_key_safe_and_no_data_corruption` | backend-integration | passing |
| ai-behavior | FR-020 | `test_acc_ai_behavior.py::test_app_fully_usable_with_no_ai_key` | backend-integration | passing |
| localization | FR-021, SC-006 | `localization-rtl.test.tsx` (dir=rtl/ltr, SAR format, no untranslated keys) | frontend-unit | planned |
| localization | FR-021, SC-006 | `acc-localization-rtl.spec.ts` (AR/EN core routes) | frontend-e2e | planned |
| localization | FR-021 | `manual-ar-en-rtl-checklist.md` (visual/RTL pass on core surfaces) | manual | planned |
| readiness | SC-007 | `test_acc_readiness_smoke.py` + CI green (`.github/workflows/ci.yml`) | backend-integration | passing |

**Rules**
- Every FR in FR-004…FR-021 appears at least once above.
- A row's `status` advances `planned → implemented → passing` as tasks complete.
- A failing verifier produces a findings-register row (E1), it is **not** resolved by
  editing product code in this phase.
- No verifier makes a live external AI provider call (FR-024): AI paths are stubbed.
