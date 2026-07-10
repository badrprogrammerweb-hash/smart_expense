# Remediation Findings Register

## Purpose

This register tracks defects or security weaknesses surfaced by Phase 10 tests or the security review. Product application code is not fixed in this phase; every issue found here is tracked for follow-up remediation.

## Severity Legend

| Severity | Meaning |
|----------|---------|
| Critical | Breaks a non-negotiable: wrong financial total or cross-tenant data exposure with a plausible trigger. |
| High | Serious privacy, permission, or financial weakness with a narrower trigger or partial mitigation present. |
| Medium | Correctness or hardening gap without direct isolation or financial exposure. |
| Low | Minor, cosmetic, or defense-in-depth improvement. |

## Release-Blocker Rule

`release_blocker = true` iff `severity` is `Critical` or `High` and `area` is `financial-accuracy` or `tenant-isolation`. These findings must be called out in the readiness summary and remediated as follow-up before a real production release.

## Findings

| ID | Title | Area | Severity | Source | Reproduction | Status | Remediation (owner/target) | Release-blocker |
|----|-------|------|----------|--------|--------------|--------|----------------------------|-----------------|
| F-001 | Arabic dashboard period range reorders and wraps in RTL | localization | Low | T031 manual AR/EN + RTL checklist | Sign in locally, open `/ar/w/<workspace-id>/dashboard`, and inspect the current-period card; `2026-07-01 - 2026-07-31` displays in the wrong visual order and wraps. | Open | Frontend localization follow-up | no |

## Readiness Summary (T034)

**Suite results** (this working tree, local Supabase stack, AI provider stubbed — no live external calls):

| Suite | Result | Notes |
|-------|--------|-------|
| Backend full suite (`pytest -q`, `apps/api/tests` incl. `tests/acceptance`) | 129 passed | 110 pre-Phase-10 + 19 Phase 10 acceptance |
| Backend acceptance suite alone (`pytest tests/acceptance -q`), determinism check | 19 passed × 3 consecutive runs | ~102–135s each; one earlier transient CPU-bound stall was observed and could not be reproduced across 3 subsequent clean runs — see the determinism note in `quickstart.md` |
| Frontend unit suite (`vitest run`) | 59 passed | includes `tests/unit/localization-rtl.test.tsx` (4 tests) |
| Frontend acceptance e2e (`playwright test acc-role-permissions.spec.ts acc-file-privacy.spec.ts acc-localization-rtl.spec.ts`), determinism check | 3 passed × 2 consecutive runs | ~1.2–1.3 min each, identical results both runs |
| Manual AR/EN + RTL checklist | 11/12 pass, 1/12 fail | Failure logged as F-001 (Low, localization, not a release blocker) |
| CI | `.github/workflows/ci.yml` committed and runs the same commands (Supabase stack, backend pytest incl. acceptance, frontend Vitest + Playwright, AI stubbed) on push/PR | Not yet exercised by a live GitHub Actions run in this environment (no push performed as part of this phase); the workflow was authored to mirror the exact commands validated above |

**Findings count by severity**: Critical 0 · High 0 · Medium 0 · Low 1 · Total 1

**Findings count by area**: financial-accuracy 0 · tenant-isolation 0 · role-permissions 0 · file-privacy 0 · ai-behavior 0 · localization 1 · deployment 0 · other 0

**Exit criteria**:

- **MVP ready for review**: Yes. Financial accuracy, tenant isolation, role permissions, file privacy, AI behavior, and localization are all covered by passing automated verifiers (see `contracts/test-coverage-matrix.md`), the security review (`security-review.md`) covers all four in-scope principles with PASS verdicts, and deployment is documented and dry-run validated.
- **No untracked tenant-isolation issues**: Yes. All tenant-isolation checks (SR-VII-01…05, `test_acc_tenant_isolation.py`, `test_workspace_isolation.py`, `test_files_isolation.py`, `test_reports_isolation.py`, `test_history_access.py`) pass; zero tenant-isolation findings in the register.
- **No untracked financial-calculation issues**: Yes. All financial-accuracy checks (SR-X-01…05, `test_acc_financial_accuracy.py`, `test_extraction_totals.py`, `test_income_expense_edit_delete.py`, `test_dashboard_summary.py`) pass; zero financial-accuracy findings in the register.
- **Deployment documented and repeatable**: Yes. `docs/deployment.md` + `infra/bunny/*` give a cited, secret-safe, repeatable procedure; both `linux/amd64` images were built and dry-run started locally (API `/health` → 200, web `/en/sign-in` → 200) during Phase 10 review.

**Release-blocker findings**: none.
