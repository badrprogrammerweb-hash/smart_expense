# Quickstart: Verifying Phase 18

**Feature**: `018-security-remediation-hardening` | **Date**: 2026-07-30

Manual verification for Phase 18. Run after implementation, before declaring the phase complete.
Details live in [contracts/](./contracts/); this is the run guide.

> **Planning-pass note**: this document is written for a future implementation run. Nothing here is
> executed during the planning phase.

---

## Prerequisites

```bash
# Local Supabase running with all migrations applied
supabase start
supabase db reset

# API dependencies
python -m pip install -r apps/api/requirements.txt

# apps/api/.env must contain at minimum
#   SUPABASE_URL, SUPABASE_DB_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET
#   APP_ENV=test          (for the dev-behaviour steps)
```

Capture the local keys once — used by the exposure checks below:

```bash
eval "$(supabase status -o env)"    # exports API_URL, ANON_KEY, SERVICE_ROLE_KEY, JWT_SECRET
```

---

## Step 0 — Prove the database mechanics (do this FIRST)

Blocking prerequisite (spec FR-015). See
[contracts/private-schema-migration.md](./contracts/private-schema-migration.md) proofs **P-1** and
**P-2**. Run both on a **disposable** database — never the working one.

**Expected**: P-1 shows the policy auto-followed the relocated function (OID-bound). P-2 shows the
dependent function body **fails** until re-created (name-bound).

If P-1 fails, stop. Switch to fallback **F-1** and re-plan — the change is materially larger than this
phase assumes.

Record both outcomes in the migration contract before writing the migration.

---

## Step 1 — Confirm the four RPCs are unreachable over HTTP

The core release-gate check (spec SC-001). **Must go through PostgREST, not `psql`** — the
vulnerability is HTTP reachability, and `authenticated` deliberately still holds `EXECUTE`.

Obtain a real user access token:

```bash
TOKEN=$(curl -s -X POST "$API_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"user-a@example.com","password":"<password>"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
```

Then attempt each relocated routine:

```bash
for fn in ensure_personal_workspace get_workspace_ai_key_for_extraction \
          find_user_profile_by_email shares_workspace_with; do
  printf '%-40s ' "$fn"
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API_URL/rest/v1/rpc/$fn" \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" -d '{}'
done
```

**Expected**: `404` for all four.

**Control check (do not skip)** — proves the harness is not simply 404-ing everything:

```bash
curl -s -o /dev/null -w 'control: %{http_code}\n' -X POST "$API_URL/rest/v1/rpc/clear_workspace_ai_key" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"p_workspace_id":"00000000-0000-0000-0000-000000000000"}'
```

**Expected**: **not** 404 (a 4xx from the function's own role check, or 200). A 404 here means the test
setup is wrong and the four results above are meaningless.

---

## Step 2 — Confirm no other account's profile can be rewritten

Spec SC-002. As user A, with user B's id:

```bash
curl -s -X POST "$API_URL/rest/v1/rpc/ensure_personal_workspace" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"target_user_id":"<USER_B_UUID>","target_email":"burner@evil.example"}'
```

**Expected**: `404`. Then confirm B's email is untouched:

```sql
select email from public.user_profiles where id = '<USER_B_UUID>';
-- EXPECT: B's original address
```

Second layer — with relocation bypassed, the guard must still refuse (spec User Story 2):

```sql
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<USER_A_UUID>","email":"user-a@example.com"}', true);
select private.ensure_personal_workspace('<USER_B_UUID>', 'burner@evil.example');
-- EXPECT: ERROR 42501 identity_mismatch
```

---

## Step 3 — Confirm a Member cannot read the Owner's AI key

Spec SC-005. Prerequisite: a team workspace with a BYOK key configured by its Owner, and a Member.

```bash
curl -s -X POST "$API_URL/rest/v1/rpc/get_workspace_ai_key_for_extraction" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $MEMBER_TOKEN" \
  -H "Content-Type: application/json" -d '{"p_workspace_id":"<WORKSPACE_UUID>"}'
```

**Expected**: `404`, and the response contains no `sk-` or `AIza` material.

Also confirm the key never appears in the normal API surface:

```bash
curl -s "http://127.0.0.1:8000/workspaces/<WORKSPACE_UUID>/ai-settings" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | grep -E 'sk-|AIza' && echo "LEAK" || echo "clean"
```

**Expected**: `clean` — only `provider`, `masked_hint` (`••••` + last 4), `updated_at`, `updated_by`.

---

## Step 4 — Confirm nothing legitimate broke

The regression half. Every one must pass (spec SC-007, SC-008, SC-009).

| # | Check | Expected |
|---|---|---|
| 4a | **Sign up a brand-new account** | Personal workspace created, new account is Owner. *This is the step that catches a non-NULL-tolerant identity guard — the single most likely way to break production in this phase.* |
| 4b | Sign in as an existing account, load the dashboard | Succeeds; no `503 workspace_bootstrap_unavailable` |
| 4c | As Owner/Admin of a team workspace, invite an existing user **by email** | Resolves to the correct account; member added |
| 4d | Invite a non-existent email | `404 user_not_found` (unchanged behaviour) |
| 4e | Trigger an AI extraction with BYOK configured | Completes; draft appears for review |
| 4f | Request an AI summary | Returns a summary |
| 4g | As a Viewer, attempt an extraction | Refused (unchanged) |
| 4h | View a co-member's name in the member list | Still visible — exercises the relocated `shares_workspace_with` through its RLS policy |
| 4i | Upload a receipt, get a download URL | Works; URL expires in ≤300s |

Step 4h is easy to overlook: it is the only user-visible exercise of the one policy that references a
relocated function.

---

## Step 5 — Rate limiting

Spec SC-010, SC-011. See [contracts/rate-limiting.md](./contracts/rate-limiting.md).

```bash
# 6 checkout attempts; allowance is 5/hour
for i in $(seq 1 6); do
  curl -s -o /dev/null -w "attempt $i: %{http_code}\n" -X POST \
    http://127.0.0.1:8000/support-purchases/checkout-sessions \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"tier_id":"support_small","locale":"en"}'
done
```

**Expected**: attempts 1–5 → `201` (or `503` if Stripe keys are unset locally — also acceptable, it
proves the limiter did not fire); attempt 6 → `429` with `code: "rate_limited"`.

Then confirm the throttled attempt changed nothing (spec FR-018):

```sql
select count(*) from public.support_purchases where user_id = '<USER_A_UUID>';
-- EXPECT: unchanged from before attempt 6
```

Verify the refusal leaks nothing:

```bash
curl -s -D- -o /tmp/rl.json -X POST http://127.0.0.1:8000/support-purchases/checkout-sessions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"tier_id":"support_small","locale":"en"}' | grep -i retry-after && echo "LEAK" || echo "clean"
cat /tmp/rl.json
```

**Expected**: `clean` (no `Retry-After`); body discloses no threshold or remaining count.

**Webhooks must NOT be throttled** — send 20 unsigned requests to
`/support-purchases/webhooks/stripe`. **Expected**: all `400 invalid_stripe_signature`, never `429`.

**Localisation** — load the support page in both locales and trigger the limit.
**Expected**: a correct Arabic message at `/ar/...` and English at `/en/...`; no raw key, no
untranslated text.

---

## Step 6 — Production surface

Spec SC-014, SC-015.

```bash
# Production
APP_ENV=production python -m uvicorn app.main:app --port 8001 &
for p in /docs /redoc /openapi.json; do
  printf '%-14s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:8001$p"
done
```

**Expected**: `404` for all three.

```bash
# APP_ENV unset — the safe-default case, the important one
env -u APP_ENV python -m uvicorn app.main:app --port 8002 &
curl -s -o /dev/null -w '/docs unset: %{http_code}\n' http://127.0.0.1:8002/docs
```

**Expected**: `404`. An absent variable must select the safe behaviour, never require opting in.

```bash
# Dev keeps the conveniences
APP_ENV=dev python -m uvicorn app.main:app --port 8003 &
curl -s -o /dev/null -w '/docs dev: %{http_code}\n' http://127.0.0.1:8003/docs
```

**Expected**: `200`.

**Health probe** — with `SUPABASE_URL` pointed at an unroutable host, `/health` must still answer
promptly, proving it makes no outbound call:

```bash
time curl -s http://127.0.0.1:8001/health
```

**Expected**: sub-100 ms, no 3-second delay, and no service-role credential used.

---

## Step 7 — Log redaction

Spec SC-012.

```python
import logging
from app.core.logging import configure_logging
configure_logging()
logging.getLogger("app.services.storage").warning(
    "probe Bearer eyJhbGciOiJIUzI1NiJ9.fake.sig for user@example.com"
)
```

**Expected**: `Bearer [REDACTED]` and `u***@example.com` in the emitted output. Before this phase, a
module-level logger like this was **not** redacted — that is the regression being fixed.

---

## Step 8 — Migration idempotency and rollback

Spec SC-016.

```bash
# Apply twice
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260731000000_private_schema_privileged_functions.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260731000000_private_schema_privileged_functions.sql
```

**Expected**: both succeed; the verification queries in
[contracts/private-schema-migration.md](./contracts/private-schema-migration.md) return identical
results.

### Rollback — one explicit target per run, on a DISPOSABLE database only

`rollback.sql` has **no whole-file mode**. It requires `-v rollback_target=...` and executes exactly
one target; the untaken branch is skipped by psql, so the two targets can never be composed. Running
the file without a target, or with an unrecognized one, exits non-zero and changes nothing.

Running both sections in one pass — which earlier revisions of this file allowed — produced an
invalid duplicate state (a guarded `public` copy *and* an unguarded `private` copy of
`ensure_personal_workspace`). That composition was never a valid procedure and must not be
reintroduced.

**Target `phase3`** — reverse the Phase 3 relocation only:

```bash
psql "$DISPOSABLE_DB_URL" -v rollback_target=phase3 \
  -f specs/018-security-remediation-hardening/rollback.sql
```

**Expected**: each of the four routines exists in `public` **exactly once** with no `private` copy
remaining; grants are `authenticated`-only (`anon` and `PUBLIC` denied); the Phase 4 identity guard
is **retained** on `public.ensure_personal_workspace`; `handle_new_user` calls
`public.ensure_personal_workspace` with `search_path = public`; the `on_auth_user_created` trigger
survives; Phase 9 is untouched and both RLS helpers stay in `private`.

**This target requires a coordinated application rollback.** The current application tree calls these
routines private-qualified (`app/core/auth.py`, `app/routes/workspace_members.py`,
`app/services/ai_summary.py`, `app/services/extractions.py`) and **will not work unchanged** against
this database state — verify with a compatible application revision whose SQL calls use `public.`,
deployed in the same change window. Do not record "the app still works" using the current tree.

**Target `identity_guard`** — reverse the Phase 4 guard only:

```bash
psql "$DISPOSABLE_DB_URL" -v rollback_target=identity_guard \
  -f specs/018-security-remediation-hardening/rollback.sql
```

**Expected**: all four Phase 3 routines remain in `private`; `private.ensure_personal_workspace`
keeps its OID, `SECURITY DEFINER`, `search_path = public`, and Phase 3 grants, and loses only the
guard; no `public` duplicate is created; `handle_new_user` still calls the private routine. **No
application rollback is required** — the current tree stays compatible.

**Fail-closed checks** (each must exit non-zero and leave the database unchanged):

```bash
psql "$DISPOSABLE_DB_URL" -f .../rollback.sql                                  # missing target
psql "$DISPOSABLE_DB_URL" -v rollback_target=everything -f .../rollback.sql    # unknown target
# identity_guard against a database where the routine is not in private → aborts, creates nothing
# phase3 against a database with both a public and a private copy → aborts, resolves nothing
```

**Neither target reverses Phase 9.** `workspace_role_for` and `is_workspace_member` stay in
`private` under both. `phase3` additionally *requires* Phase 9 to remain in place, because the
relocated-to-`public` `get_workspace_ai_key_for_extraction` body still calls
`private.workspace_role_for` by name.

**Static gate**:

```bash
grep -icE 'create policy|drop policy|create table|alter table' \
  supabase/migrations/20260731000000_private_schema_privileged_functions.sql
# EXPECT: 0

grep -rn 'public\.\(ensure_personal_workspace\|find_user_profile_by_email\|get_workspace_ai_key_for_extraction\|shares_workspace_with\)' apps/api/app
# EXPECT: no matches
```

---

## Step 9 — Full regression suites

The frontend browser gate is **two separate gates**, exactly as `.github/workflows/ci.yml` splits
them. Running one bare `npx playwright test e2e` conflates them and will report Linux-baseline
snapshot diffs as functional failures on any non-Linux machine.

### 9a — Backend and web unit suites

```bash
cd apps/api && python -m pytest tests/ -q
npm run test --workspace=@smart-expense/web
```

### 9b — Functional e2e, visual regression EXCLUDED

The CI contract (`.github/workflows/ci.yml`, "Run frontend acceptance tests"):

```bash
cd apps/web && npx playwright test e2e --workers=1 --grep-invert "design refresh visual regression"
```

**Expected**: exit 0, no failures.

> **Report skipped counts, not just passes.** `tests/e2e/{auth,categories,error-states,income-expense-flow,reports,roles,workspace-switch}.spec.ts`
> self-skip unless `E2E_EMAIL` / `E2E_PASSWORD` (and for some, `E2E_MEMBER_*` / `E2E_VIEWER_*` /
> `E2E_TEAM_WORKSPACE_ID`) are exported. CI does **not** set them, so CI's green covers fewer specs
> than the file count suggests. A run reported only as "N passed" hides this. To exercise those
> specs, export the credentials and re-run; record both runs.

### 9c — Visual regression, pinned Linux container ONLY

The committed baselines in `apps/web/e2e/__screenshots__/` were captured in
`mcr.microsoft.com/playwright:v1.61.1-noble`. Font rasterisation differs on Windows and on bare
`ubuntu-latest`, so this spec is meaningful **only** inside that image
(`.github/workflows/ci.yml`, `visual-regression` job):

```bash
docker run --rm --network host -v "$PWD:$PWD" -w "$PWD" -e CI=true \
  mcr.microsoft.com/playwright:v1.61.1-noble \
  bash -lc "npm ci && cd apps/web && npx playwright test e2e/visual-regression.spec.ts \
    --workers=1 --project=chromium --project=mobile-rtl"
```

**Never run this against a working tree you care about on Docker Desktop for Windows/macOS.** The
bind mount means the container's `npm ci` rewrites the host `node_modules/` with Linux-native
binaries, breaking subsequent host-side runs until reinstalled. It also assumes `--network host`
reaches a host-side API on `127.0.0.1:8000`, which holds on a Linux runner but **not** on Docker
Desktop, where host networking joins the Linux VM rather than the host OS.

**Never run with `--update-snapshots` outside this image.** Regenerating Linux baselines from
Windows silently replaces the reference set.

On Docker Desktop (Windows/macOS) `--network host` joins the Linux VM rather than the host OS, so
the command above cannot reach a host-side API. Run everything in Linux instead, on the network the
local Supabase stack already uses — this is the form that was actually executed and passed:

```bash
# 1. Isolated copy of the working tree (source mounted read-only, no host node_modules)
docker volume create p11-ws
docker run --rm -v p11-ws:/w -v "<repo>:/src:ro" alpine:3 \
  sh -c "rsync -a --delete --exclude=node_modules --exclude=.next --exclude=.git \
         --exclude=test-results --exclude=out --exclude=.venv /src/ /w/"

# 2. API in Linux, reaching Supabase by its network aliases (kong / db)
docker run -d --name p11-api --network supabase_network_<project> -v p11-ws:/w \
  -e SUPABASE_URL=http://kong:8000 \
  -e SUPABASE_DB_URL="postgresql+asyncpg://postgres:postgres@db:5432/postgres" \
  -e SUPABASE_SERVICE_ROLE_KEY=*** -e SUPABASE_JWT_SECRET=*** -e APP_ENV=test \
  python:3.12-slim sh -c 'cd /w/apps/api && pip install -r requirements.txt \
    && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000'

# 3. Web + Playwright in the pinned image, same network
docker run -d --name p11-pw --network supabase_network_<project> -v p11-ws:/w \
  mcr.microsoft.com/playwright:v1.61.1-noble sleep infinity
docker exec p11-pw sh -c 'cd /w && npm ci'
docker exec p11-pw sh -c 'cd /w/apps/web && npm run build'
docker exec -d p11-pw sh -c 'cd /w/apps/web && npm run start'
docker exec p11-pw sh -c 'cd /w/apps/web && npx playwright test e2e/visual-regression.spec.ts \
  --workers=1 --project=chromium --project=mobile-rtl --reporter=list'
```

Write `apps/web/.env.local` **inside the volume** so `NEXT_PUBLIC_API_URL=http://p11-api:8000` and
`NEXT_PUBLIC_SUPABASE_URL=http://kong:8000` resolve from the browser in the container. Before
capturing, prove from inside the container that the web, API, and Supabase respond **and** that
`127.0.0.1:8000` / `127.0.0.1:54321` do **not** — that is what shows no host process is being used.

**Result (2026-08-03): PASS — 4 passed, 0 failed, exit 0, 1.1 min**, in
`mcr.microsoft.com/playwright@sha256:5b8f294a…` (Playwright 1.61.1, Chromium 149.0.7827.55).
**The committed baselines were not regenerated** — all 32 verified byte-for-byte identical before
and after.

If the pinned container cannot be run faithfully, record 9c as **explicitly pending** — it does not
block 9a/9b.

### Why 9c is period-stable

The dashboard's reporting window is computed server-side
(`apps/api/app/services/dashboard.py` `get_current_period()` → `datetime.now(UTC+3)`), and
`GET /workspaces/{id}/dashboard` takes no period argument, so the spec's `page.clock` freeze cannot
pin it. The baselines were captured in July 2026, so from August onward the real response drifted
and `*-mobile-navigation-dialog` no longer matched. `apps/web/e2e/_helpers/visual-dashboard.ts`
intercepts **only** that request, takes the real response, and overwrites just the period and the
fields the server derives from it. Re-capturing the baselines instead would only have re-frozen a
different month and broken again the next one.

**Expected across Step 9**: all pass with **no assertion modified** (spec FR-039). If a test had to
change, either behaviour changed (a defect in this phase) or that test was asserting an
implementation detail — either way it must be recorded explicitly, not quietly amended.

---

## Step 10 — RELEASE GATE: hosted exposed-schemas evidence

Spec FR-038, SC-018. **Cannot be automated and cannot be skipped.**

`supabase/config.toml:11` governs the **local** stack only. Hosted Supabase sets exposed schemas in
**Dashboard → Project Settings → API → Exposed schemas** (default `public, graphql_public`). If
`private` appears there, every fix in this phase silently reverts to exploitable — **no code change,
no failing test**.

1. Open the target project's API settings.
2. Confirm the exposed-schema list is `public, graphql_public` and does **not** include `private`.
3. **Record evidence** — a screenshot or an API-settings dump — attached to the release record.
4. Run the deployed smoke check:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  "https://<PROJECT>.supabase.co/rest/v1/rpc/ensure_personal_workspace" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" -d '{}'
# EXPECT: 404
```

Send the **real** argument names (`target_user_id`, `target_email`). That matters: the live signature
is `ensure_personal_workspace(target_user_id uuid, target_email text)`
(`supabase/migrations/20260624000000_auth_workspace_foundation.sql:96`), so a 404 for *those* names
proves the routine is unresolvable in the exposed schema rather than merely mis-called. Then run the
**EX-5 control** against the same host, key, and token — without it a project that 404s every RPC
would make the check pass vacuously:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  "https://<PROJECT>.supabase.co/rest/v1/rpc/clear_workspace_ai_key" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"p_workspace_id":"00000000-0000-0000-0000-000000000000"}'
# EXPECT: NOT 404 — a 4xx from the function's own role check, or 200
```

This is the only check that catches dashboard drift. Repeat it after any Supabase project
configuration change.

### Step 10 deployed smoke — executed 2026-08-03: **PASS** (T093)

Run manually against `https://wyno***.supabase.co` with the publishable key and an ordinary user
token (`role=authenticated`, subject present). **No `service_role` or secret key was used.**

| | Target | Control (EX-5) |
|---|---|---|
| RPC | `ensure_personal_workspace` | `clear_workspace_ai_key` |
| Arguments | `target_user_id=00000000-0000-0000-0000-000000000000`, `target_email=t093-probe@example.invalid` | `p_workspace_id=00000000-0000-0000-0000-000000000000` |
| Status | **404** ✅ | **403** ✅ (non-404) |
| Body | `PGRST202` — "Searched for the function `public.ensure_personal_workspace` with parameters `target_email, target_user_id` … no matches were found in the schema cache" | `42501` — `not_owner` |

The target is unresolvable in the exposed schema, and PostgREST confirms it searched **`public`**
specifically — so no public fallback or duplicate resolves. Its hint offered an unrelated public
routine (`receipt_object_workspace_id`), which incidentally proves the `public` schema cache is
populated and searchable, so the 404 is relocation-specific rather than an empty or broken cache.
The control resolved and reached its own authorization logic, proving URL, key, token, and RPC
mechanism all work. `not_owner` (rather than 401) also confirms the token authenticated as a real
user.

**No mutation occurred**: the target 404s before invocation, and the control aborted at its owner
check on a nil workspace id.

### Step 10 exposed-schema evidence — recorded 2026-08-03: **PASS** (T092)

Captured from the hosted project's **Integrations → Data API → Settings → Exposed schemas**. The
screenshot was reviewed as **external release evidence on 2026-08-03** and is retained with the
release record — deliberately not committed to this repository:

| Schema | Exposed? |
|---|---|
| `graphql_public` | ✅ ticked |
| `public` | ✅ ticked |
| **`private`** | ❌ **present in the list but NOT ticked** |

The control summarises as **"2 of 3 schemas exposed"**, matching the required
`public, graphql_public`. `private` existing in the picker is expected — the phase creates that
schema — and the gate is precisely that it is *never selected*.

Also visible and worth recording: **Extra search path** is `PUBLIC, EXTENSIONS` and does **not**
include `private`.

Two honest limits of this artifact:

1. **It does not self-identify the project.** The captured region shows no project name or ref, so
   the screenshot alone does not prove which project it is. It is corroborated by T093 above, whose
   live `404 / PGRST202` from `https://wyno***.supabase.co` is exactly the runtime behaviour this
   setting produces — a project with `private` exposed could not return that.
2. **It shows UI state, not proof of a saved write.** The picker is open and a Cancel control is
   present, so the image alone cannot distinguish a saved setting from an unsaved edit. T093's live
   probe resolves this: the *effective* runtime configuration already excludes `private`.

Together the two gates are conclusive; neither alone would be.

> **Both parts of Step 10 are now closed** — T092 (this settings evidence) and T093 (the deployed
> smoke). Both are **point-in-time**: re-run the smoke and re-capture this setting after any Supabase
> project configuration change, because a later edit here silently re-exposes every relocated
> routine with no code change and no failing test.

#### Related posture observation (not part of the T092 contract)

**Automatically expose new tables** is **enabled**, and the Dashboard itself advises disabling it.
This does not affect T092 — it governs tables, not schema exposure, and `private` is not exposed, so
nothing in `private` is reachable regardless. It does mean any *future* table created in `public`
is exposed by default. Recorded as a hardening follow-up, not a gate failure.

---

## Out of scope — must NOT be claimed as done

- Phase 17 **T052** (live Stripe test-mode, Apple sandbox, Google Play internal-testing sweep) stays
  **unchecked**. Nothing in this quickstart exercises a real payment.
- Placeholder Stripe price IDs (`core/support_tiers.py:25,34,43`) remain placeholders — a separate
  release-readiness task, not a security fix.
- User Story 7 (relocating `workspace_role_for` / `is_workspace_member`) is P3 and droppable. If it
  was not attempted, say so; do not imply the residual risk was closed.
