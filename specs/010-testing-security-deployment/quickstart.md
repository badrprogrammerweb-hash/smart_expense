# Quickstart: Testing, Security Review, and Deployment

This validates the Phase 10 deliverables end-to-end. It runs the cross-cutting
acceptance suites, confirms the security review + findings register exist and are
consistent, and checks the deployment docs/config are followable. **No product code
is changed by this phase.**

## Prerequisites

- Supabase CLI (Docker) local stack, same as Phases 2–9.
- Backend deps installed (`apps/api/requirements.txt`); `apps/api/.env` populated as
  in `.env.example`.
- Frontend deps installed (`apps/web`), Playwright browsers installed.
- AI provider calls run in stub mode (no live key, no external call).

## 1. Bring up the stack and seed

```bash
supabase start
supabase db reset          # apply tracked migrations to a clean local DB
```

The acceptance suite's shared fixture (`apps/api/tests/acceptance/conftest.py`) seeds
a deterministic world: two workspaces owned by different users, one member per role
(Owner/Admin/Member/Viewer), confirmed income+expenses, plus deleted, edited, draft,
and failed-AI records. It tears the seed down after the run.

## 2. Run the backend acceptance suite (financial accuracy, isolation, roles, files, AI)

```bash
cd apps/api
pytest tests/acceptance -q
```

**Expected**: all pass. Concretely — remaining balance equals confirmed income −
confirmed expenses across zero/negative/edited/deleted/draft/failed states (no float
drift); every cross-workspace and unauthenticated attempt is denied; the role matrix
matches intent and Viewer makes zero successful writes; files are private with no
public URL and are membership-scoped; the BYOK key never appears in any response/log/
error and unconfirmed AI moves zero totals. Any failure ⇒ a findings-register row
(`F-NNN`), **not** a product-code fix. The full existing suite (`pytest tests`) must
also remain green (this phase adds tests, changes no behavior).

## 3. Run the frontend acceptance tests (roles, file privacy, AR/EN + RTL)

```bash
cd apps/web
npx vitest run tests/unit/localization-rtl.test.tsx
npx playwright test e2e/acc-role-permissions.spec.ts e2e/acc-file-privacy.spec.ts e2e/acc-localization-rtl.spec.ts
```

**Expected**: Arabic renders `dir="rtl"`, English `dir="ltr"`, amounts use SAR
formatting, no raw untranslated keys on core surfaces; role-gated UI denies/permits
per role; no public file URL is surfaced.

## 4. Manual AR/EN + RTL checklist

Walk `specs/010-testing-security-deployment/manual-ar-en-rtl-checklist.md`: each core
surface (dashboard, income/expense entry, reports/summaries, history, settings, AI
review) × {Arabic, English}. Confirm layout mirroring and no truncation. Record
pass/fail; failures ⇒ findings-register rows.

## 5. CI

Confirm `.github/workflows/ci.yml` runs the same suites (Supabase stack + backend
pytest + frontend Vitest/Playwright, AI stubbed) and reports pass/fail on push/PR
(SC-007).

## 6. Security review + findings register

- `security-review.md` covers principles VI, VII, IX, X with a PASS/FAIL/N-A verdict
  and evidence per check (structure per `contracts/security-review.md`).
- Every `FAIL` links to a `findings-register.md` row; the register follows
  `contracts/findings-register.md`. Confirm **no untracked** known issue remains
  (SC-010) and that any release-blocker findings are listed.

## 7. Deployment docs/config dry-run

Have someone who did not write it read `docs/deployment.md` + `infra/bunny/*` and
confirm: every required env var/secret/external service from `contracts/deployment.md`
is listed; Bunny steps are cited to official docs; the two VERIFY items (env/secret
mechanism, tag selection) are flagged not invented; the production-migration step is
present; no secret value is committed. Building the `linux/amd64` images locally and
validating they start is the dry-run (a live production deploy is **not** required —
FR-030a).

## Done when

- Backend + frontend acceptance suites pass (or every failure is a tracked finding).
- Security review covers all four principles; findings register has no untracked
  issues; release-blockers (if any) are listed.
- Deployment docs/config are complete, cited, secret-safe, and followable.
- Readiness summary states all four exit criteria against the evidence.
