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

```bash
# Rollback, on a DISPOSABLE database only
psql "$DISPOSABLE_DB_URL" -f specs/018-security-remediation-hardening/rollback.sql
```

**Expected**: the four functions are back in `public` with their original grants; the app still works.

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

```bash
cd apps/api && python -m pytest tests/ -q
npm run test --workspace=@smart-expense/web
cd apps/web && npx playwright test e2e --workers=1
```

**Expected**: all pass with **no assertion modified** (spec FR-039). If a test had to change, either
behaviour changed (a defect in this phase) or that test was asserting an implementation detail —
either way it must be recorded explicitly, not quietly amended.

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

This is the only check that catches dashboard drift. Repeat it after any Supabase project
configuration change.

---

## Out of scope — must NOT be claimed as done

- Phase 17 **T052** (live Stripe test-mode, Apple sandbox, Google Play internal-testing sweep) stays
  **unchecked**. Nothing in this quickstart exercises a real payment.
- Placeholder Stripe price IDs (`core/support_tiers.py:25,34,43`) remain placeholders — a separate
  release-readiness task, not a security fix.
- User Story 7 (relocating `workspace_role_for` / `is_workspace_member`) is P3 and droppable. If it
  was not attempted, say so; do not imply the residual risk was closed.
