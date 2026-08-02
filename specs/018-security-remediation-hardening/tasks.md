---

description: "Task list for Phase 18 — Security Remediation and Production Hardening"
---

# Tasks: Security Remediation and Production Hardening

**Input**: Design documents from `specs/018-security-remediation-hardening/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **REQUIRED** for this feature. Spec FR-037 mandates a security regression suite, and
[contracts/security-regression-tests.md](./contracts/security-regression-tests.md) enumerates every
required assertion by ID (EX-*, ID-*, RL-*, LG-*, JW-*, PS-*, RG-*, MG-*). Task descriptions
reference those IDs directly.

**Organization**: Strictly phase-by-phase so one phase can be implemented, reviewed, and validated
at a time. Phases 3–4 are the release blockers; Phases 9–10 are explicitly droppable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `[US1]`..`[US8]` maps to the user story in [spec.md](./spec.md)
- Exact file paths are given in every task

## Path Conventions

Monorepo. Backend `apps/api/`, migrations `supabase/migrations/`, web `apps/web/`, CI
`.github/workflows/`. `apps/mobile/` is **not touched** in this phase — verified to hold no
privileged RPC call sites.

---

## Phase 1: Blocking Database-Mechanics Proof

**Purpose**: Prove the two PostgreSQL behaviours the entire migration design rests on, **before any
migration is authored**. Spec FR-015.

**⚠️ HARD BLOCKER**: No task in Phase 3 or beyond may begin until T004 is recorded. If T002 fails,
the phase must be re-planned, not improvised — the change becomes materially larger and the decision
to defer `workspace_role_for` / `is_workspace_member` is invalidated too.

**⚠️ DISPOSABLE DATABASE ONLY**: T001–T003 must run against a scratch database or a throwaway
container. Never against the working local database.

- [X] T001 Create a disposable Postgres database (or throwaway container) for the proof; record the connection string in `specs/018-security-remediation-hardening/contracts/private-schema-migration.md` under a new "Proof run" heading
- [X] T002 Execute proof **P-1** from `specs/018-security-remediation-hardening/contracts/private-schema-migration.md`: create a table with RLS, a helper function, and a policy calling that helper; run `ALTER FUNCTION ... SET SCHEMA`; assert via `pg_get_expr(polqual, polrelid)` that the policy auto-followed and still filters correctly (OID-bound)
- [X] T003 Execute proof **P-2** from the same contract: create a second function whose plpgsql body calls the relocated helper **by name**; assert the call fails with "function ... does not exist" only when **invoked**, not when relocated (name-bound, runtime failure)
- [X] T004 Record both proof outcomes verbatim in `specs/018-security-remediation-hardening/contracts/private-schema-migration.md`; if P-1 failed, STOP and escalate to fallback F-1 re-planning instead of continuing
- [X] T005 Destroy the disposable database created in T001

**Checkpoint**: The one-migration design is validated, or the phase is halted. Nothing has touched
the real database.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Re-confirm the reference inventory against current code and capture the regression
baseline that every later "no behaviour change" claim is measured against.

**⚠️ CRITICAL**: Phases 3+ depend on T007's baseline existing. Without it, "no assertion modified"
(spec FR-039) and "identical access decisions" (SC-006) cannot be demonstrated.

- [X] T006 [P] Re-verify the relocation inventory in `specs/018-security-remediation-hardening/data-model.md` §1 still matches the code: grep `supabase/migrations/` and `apps/api/` for each of the four target functions; confirm exactly 1 body reference (`handle_new_user`, `supabase/migrations/20260624000000_auth_workspace_foundation.sql:283`), exactly 1 policy reference (`:162`), and exactly 4 backend call sites; update the inventory if anything drifted (FR-004)
- [X] T007 Capture the green regression baseline: run `cd apps/api && python -m pytest tests/ -q` and save the full output to `specs/018-security-remediation-hardening/baseline-pytest.txt`; this is the before-image for spec FR-039 and SC-006
- [X] T008 [P] Pre-check for tests that would break when the docs surface and `/health` payload change: grep `apps/api/tests/` and `apps/web/tests/` for `openapi.json`, `/docs`, `/redoc`, and `dependencies` (likely `apps/api/tests/acceptance/test_acc_readiness_smoke.py`); record findings in `specs/018-security-remediation-hardening/contracts/security-regression-tests.md` under Group PS pre-work
- [X] T009 [P] Confirm `supabase/config.toml:11` still reads `schemas = ["public"]` and record that this file must NOT be modified by this phase (adding `private` here would defeat the entire fix)
- [X] T010 [P] Confirm `apps/mobile/` contains no `rest/v1/rpc` call sites, so no mobile change is required; record the result in `specs/018-security-remediation-hardening/plan.md` if it has drifted

**Checkpoint**: Inventory confirmed accurate, baseline captured, no-touch files identified.

---

## Phase 3: User Story 1 — Privileged routines unreachable from any client (Priority: P1) 🎯 MVP / RELEASE BLOCKER

**Goal**: Move the four confirmed-vulnerability routines out of the PostgREST-published `public`
schema so no client holding only ordinary end-user credentials can invoke them, while the trusted
backend and every RLS policy keep working unchanged. Closes C1, H1, M1, and M2 exposure.

**Independent Test**: Sign in as an ordinary user; call all four routines directly at
`POST /rest/v1/rpc/<name>` with that user's token — all four return 404, and a control call to a
still-public routine does not. Then exercise signup bootstrap, invite-by-email, AI extraction, and
AI summary through the app — all succeed.

### Tests for User Story 1 (write first, confirm they FAIL)

- [x] T011 [P] [US1] Write Group **EX** tests in `apps/api/tests/test_private_schema_exposure.py` covering EX-1..EX-4: each of the four routines called over **PostgREST HTTP** (not psql, not the FastAPI app) with a real user access token plus the anon key returns 404 (FR-001, FR-002, SC-001, SC-003, SC-004)
- [x] T012 [P] [US1] Add **EX-5** control assertion to `apps/api/tests/test_private_schema_exposure.py`: a still-public safe routine (e.g. `clear_workspace_ai_key`) does NOT return 404, proving the four 404s are relocation-specific rather than a broken harness — without this, EX-1..4 can pass vacuously
- [x] T013 [P] [US1] Add **EX-2** key-secrecy assertion to `apps/api/tests/test_private_schema_exposure.py`: as a **Member** of a BYOK-configured workspace, the key-retrieval RPC returns 404 and the response body contains no `sk-` or `AIza` material (FR-009, SC-005)
- [x] T014 [P] [US1] Add **EX-6** and **EX-7** privilege assertions to `apps/api/tests/test_private_schema_exposure.py`: `authenticated` retains `USAGE` on `private` and `EXECUTE` on all four relocated functions, and `workspace_role_for` / `is_workspace_member` remain in `public` and executable (FR-003, FR-007, FR-011)
- [x] T015 [P] [US1] Write Group **MG** static and idempotency tests in `apps/api/tests/test_migration_safety.py` covering MG-1 (apply twice, same end state), MG-4 (zero `create policy`/`drop policy`/`create table`/`alter table` in the migration file), MG-5 (no `public.` call site remains in `apps/api`), MG-6 (`on_auth_user_created` trigger survives) (FR-010, FR-012, SC-006, SC-016)

### Implementation for User Story 1

- [x] T016 [US1] Create `supabase/migrations/20260731000000_private_schema_privileged_functions.sql` with Step 1–2 from `specs/018-security-remediation-hardening/contracts/private-schema-migration.md`: `create schema if not exists private` and `grant usage on schema private to authenticated` (FR-002, FR-003)
- [x] T017 [US1] Add Step 3 to the same migration: four guarded relocations wrapped in `do $$ ... $$` blocks keyed on `pg_proc` + `pg_namespace` + `pg_get_function_identity_arguments`, for `ensure_personal_workspace(uuid,text)`, `get_workspace_ai_key_for_extraction(uuid)`, `find_user_profile_by_email(text)`, and `shares_workspace_with(uuid,uuid)` (FR-002, FR-012, FR-016)
- [x] T018 [US1] Add Step 4 to the same migration: `revoke all ... from public, anon` and `grant execute ... to authenticated` on each of the four relocated functions, making the intended end state explicit (FR-007)
- [x] T019 [US1] Add Step 5 to the same migration: `create or replace function public.handle_new_user()` changing `public.ensure_personal_workspace` to `private.ensure_personal_workspace` with `set search_path = public, private` — the ONE dependent body reference; omitting this breaks every new signup at runtime while the migration reports success (FR-004, FR-006)
- [x] T020 [US1] Add the Step 7 warning comment to the migration verbatim from the contract, stating that `EXECUTE` must never be revoked from `authenticated` on `workspace_role_for` / `is_workspace_member` because ~55 RLS policy references evaluate them as the requesting user (FR-011)
- [x] T021 [P] [US1] Re-qualify the call site in `apps/api/app/core/auth.py:144` to `select private.ensure_personal_workspace(:user_id, :email)` (FR-005)
- [x] T022 [P] [US1] Re-qualify the call site in `apps/api/app/routes/workspace_members.py:142` to `select id, email from private.find_user_profile_by_email(:email)` (FR-005)
- [x] T023 [P] [US1] Re-qualify the call site in `apps/api/app/services/extractions.py:245` to `from private.get_workspace_ai_key_for_extraction(cast(:workspace_id as uuid))` (FR-005)
- [x] T024 [P] [US1] Re-qualify the call site in `apps/api/app/services/ai_summary.py:63` to `from private.get_workspace_ai_key_for_extraction(cast(:workspace_id as uuid))` (FR-005)
- [x] T025 [US1] Author `specs/018-security-remediation-hardening/rollback.sql` per the contract's Reversal section, split into two independently runnable sections — "Section A: reverse relocation" and "Section B: reverse identity guard" — so the two changes can be reverted independently; it MUST NOT be placed in `supabase/migrations/` (FR-013, FR-014)
- [x] T026 [US1] Run the five post-migration verification queries from the contract against the local database and confirm each expected result; record output in `specs/018-security-remediation-hardening/contracts/private-schema-migration.md`
- [x] T027 [US1] Run Group **RG** regression suites RG-1, RG-2, RG-6, RG-7, RG-8, RG-9, RG-10 and diff against `baseline-pytest.txt` from T007; confirm zero assertion changes and identical access decisions for Owner/Admin/Member/Viewer/non-member (FR-010, FR-039, SC-006, SC-007, SC-008, SC-009)

**Checkpoint**: All four confirmed vulnerabilities are closed at the exposure layer. This alone is a
shippable, releasable increment.

---

## Phase 4: User Story 2 — Bootstrap routine refuses to act for anyone but the caller (Priority: P1) 🎯 RELEASE BLOCKER

**Goal**: Add a second, independent control inside `ensure_personal_workspace` so the Critical
finding stays closed even if the hosted exposed-schema setting regresses — that setting lives outside
version control and its failure would be invisible to every test.

**Independent Test**: With relocation deliberately bypassed (calling the routine directly), a caller
identity that differs from the target identity is refused with `42501`; a matching identity succeeds;
and a NULL caller identity (the trigger path) succeeds.

### Tests for User Story 2 (write first, confirm they FAIL)

- [x] T028 [P] [US2] Write **ID-1** in `apps/api/tests/test_identity_guard.py`: with `request.jwt.claims` set to user A and `target_user_id` = user B, invoking the routine **directly** raises `42501` and B's `user_profiles.email` is unchanged — must call the routine directly, NOT through an endpoint, because `_repair_personal_workspace` (`apps/api/app/core/auth.py:147-152`) swallows `DBAPIError` and the test would pass without exercising the guard (FR-008, SC-002)
- [x] T029 [P] [US2] Write **ID-2** in `apps/api/tests/test_identity_guard.py`: claims = A and `target_user_id` = A succeeds (FR-008)
- [x] T030 [P] [US2] Write **ID-3** in `apps/api/tests/test_identity_guard.py`: invoked with no request context so `auth.uid()` is NULL — as `handle_new_user` does — succeeds; this is the test that catches a guard written as `auth.uid() = target_user_id`, which would break every new signup (FR-008, SC-007)
- [x] T031 [P] [US2] Write **ID-4** and **ID-5** in `apps/api/tests/test_identity_guard.py`: a new `auth.users` insert still creates a personal workspace with the account as Owner, and an account whose stored email drifts from its session email has its own email corrected on the next request (FR-008, SC-007)

### Implementation for User Story 2

- [x] T032 [US2] Add Step 6 to `supabase/migrations/20260731000000_private_schema_privileged_functions.sql`: `create or replace function private.ensure_personal_workspace(uuid, text)` prefixing the existing body with the guard `if auth.uid() is not null and auth.uid() is distinct from target_user_id then raise exception 'identity_mismatch' using errcode = '42501'; end if;` — use `is distinct from`, not `<>`, so a NULL `target_user_id` compares safely; copy the remainder byte-identically from `supabase/migrations/20260624000000_auth_workspace_foundation.sql:105-138` and keep `set search_path = public` (FR-008, FR-016)
- [x] T033 [US2] Add the explanatory comment above the guard recording why it is NULL-tolerant (the `handle_new_user` trigger path has no request context) and why it exists despite relocation (the hosted exposed-schema setting is outside version control)
- [x] T034 [US2] Extend `specs/018-security-remediation-hardening/rollback.sql` Section B so reverting the guard restores the pre-guard body without reverting the relocation (FR-014, MG-3)
- [ ] T035 [US2] Run `apps/api/tests/test_signup_bootstrap.py` (RG-7) plus a manual end-to-end signup through the app per quickstart Step 4a, confirming a brand-new account gets its personal workspace (SC-007)

**Checkpoint**: Two independent controls now protect the Critical finding. Release-blocking scope is
complete.

---

## Phase 5: User Story 3 — Costly operations resist abuse (Priority: P2)

**Goal**: Per-account throttling on the four operations that cost real money or third-party quota,
refusing before any financial or purchase state change and before any provider call.

**Independent Test**: Drive one account past each threshold; the excess request returns `429` with
`code: "rate_limited"`, creates zero purchase rows, and makes zero provider calls. A second account
is unaffected. Webhooks are never throttled.

### Tests for User Story 3 (write first, confirm they FAIL)

- [x] T036 [P] [US3] Write **RL-1**, **RL-5**, **RL-6**, **RL-9**, **RL-12** in `apps/api/tests/test_rate_limits.py`: each bucket refuses at allowance+1 with `429`/`rate_limited`; account isolation; window expiry allows the next request; the refusal discloses no threshold or remaining window and sends no `Retry-After`; an unauthenticated request returns `401` not `429` (FR-017, FR-019, FR-020)
- [x] T037 [P] [US3] Write **RL-2**, **RL-3**, **RL-4** in `apps/api/tests/test_rate_limits.py` — the ordering proof: a throttled checkout creates zero `support_purchases` rows and never invokes the mocked Stripe client; a throttled mobile verify never invokes Apple/Google verification; a throttled AI request never invokes a provider and never reads the BYOK key. Assert on the mocks being uncalled, not merely on the status code (FR-018, SC-010)
- [x] T038 [P] [US3] Write **RL-7** in `apps/api/tests/test_rate_limits.py`: all three webhook routes accept a burst far beyond any allowance, returning their normal signature-failure responses and never `429` (FR-021, SC-011)
- [x] T039 [P] [US3] Write **RL-8** in `apps/api/tests/test_rate_limits.py`: an internal limiter error results in refusal, not passage (FR-024)
- [x] T040 [P] [US3] Write **RL-10** in `apps/api/tests/test_rate_limits.py`: two identical rapid checkout submissions produce one Checkout Session, not two (FR-022)
- [x] T041 [P] [US3] Write **RL-11** in `apps/web/messages/__tests__/` or the existing message-parity test: `errors.rateLimited` exists and is non-empty in both `apps/web/messages/en.json` and `apps/web/messages/ar.json` (FR-025, SC-019)

### Implementation for User Story 3

- [x] T042 [US3] Create `apps/api/app/core/rate_limit.py`: a fixed-window counter keyed on `(str(user_id), bucket_name)` using a **monotonic** clock so NTP or DST changes cannot widen a window; lazily evict rolled windows on access and cap total entries (discarding oldest) so the dict is not itself a memory-growth vector; guard concurrency so two simultaneous requests cannot both take the final slot (FR-023)
- [x] T043 [US3] Add the `_rate_limited()` HTTP 429 helper to `apps/api/app/core/rate_limit.py` returning `{"error": {"code": "rate_limited", "message": ...}}` with no threshold, no remaining count, and no `Retry-After` header; wrap the counter call in `try/except Exception` that raises the same refusal, so the limiter fails **closed** (FR-019, FR-024)
- [x] T044 [US3] Add the four bucket allowances to `apps/api/app/core/config.py` as settings with defaults `support_checkout=5`, `support_verify=10`, `ai_extraction=30`, `ai_summary=10` per fixed one-hour window (FR-017)
- [x] T045 [US3] Add four `Depends`-able limiter factories to `apps/api/app/core/rate_limit.py`, each taking `current_user: CurrentUser = Depends(get_current_user)` so the key is per account; rely on FastAPI's per-request dependency cache so the token is not verified twice (FR-020)
- [x] T046 [P] [US3] Attach the limiter as a **route-level** `dependencies=[...]` argument on the decorator at `apps/api/app/routes/support_purchases.py:444` (checkout) and `:520` (mobile verify) — route-level, not in-body, so it resolves before `get_trusted_session` opens a transaction (FR-018)
- [x] T047 [P] [US3] Attach the limiter as a route-level `dependencies=[...]` argument on the extraction trigger route at `apps/api/app/routes/extractions.py:25` (FR-018)
- [x] T048 [P] [US3] Attach the limiter as a route-level `dependencies=[...]` argument on the AI summary route at `apps/api/app/routes/reports.py:52` (FR-018)
- [x] T049 [US3] Verify no limiter is attached to `apps/api/app/routes/support_purchases.py:743`, `:801`, or `:895` (the Stripe/Apple/Google webhook routes) — a verified provider delivery must never be refused (FR-021)
- [x] T050 [US3] Replace the `uuid4()` component of the Stripe idempotency key at `apps/api/app/routes/support_purchases.py:476` with a derivation over `(user_id, tier_id, coarse time bucket)`; the bucket must be short enough that a deliberate second purchase of the same tier still succeeds and long enough that a double-click collapses (FR-022)
- [x] T051 [P] [US3] Add `errors.rateLimited` to `apps/web/messages/en.json` under the existing `errors` namespace — do NOT reuse or rename the unrelated `extraction.rate_limited` key at line 455, which means the AI provider is throttling us (FR-025)
- [x] T052 [P] [US3] Add the Arabic `errors.rateLimited` to `apps/web/messages/ar.json` (FR-025, SC-019)
- [x] T053 [US3] Document the accepted limitations in `specs/018-security-remediation-hardening/contracts/rate-limiting.md`: per-instance counters multiply the effective allowance by instance count on Bunny Magic Containers, counters reset on restart, and a fixed window permits up to 2x the allowance across a boundary (FR-023)

**Checkpoint**: The four costly endpoints are bounded per account; webhooks and financial state are
provably untouched.

---

## Phase 6: User Story 4 — Log redaction actually applies (Priority: P2)

**Goal**: Attach the existing secret-redaction filter where it actually sees the application's log
records, so the safety net protects the next log statement anyone writes.

**Independent Test**: A credential logged through a module-level logger appears redacted in handler
output.

### Tests for User Story 4 (write first, confirm they FAIL)

- [x] T054 [P] [US4] Write **LG-1**, **LG-2**, **LG-4** in `apps/api/tests/test_log_redaction.py`: a bearer credential and an email logged via `logging.getLogger("app.services.storage")` appear redacted/masked in captured **handler** output, and top-level logger output is still redacted. Assert on handler output, not on the `LogRecord` object — asserting on the record can pass while real output is unredacted (FR-026, SC-012)
- [x] T055 [P] [US4] Write **LG-3** in `apps/api/tests/test_log_redaction.py`: sensitive content passed as a formatting argument (`logger.warning("x: %s", secret)`) is redacted (FR-027, SC-012)
- [x] T056 [P] [US4] Write **LG-5** in `apps/api/tests/test_log_redaction.py`: an already-self-redacted message is not doubly mangled (FR-026)

### Implementation for User Story 4

- [x] T057 [US4] Rewrite `configure_logging()` in `apps/api/app/core/logging.py:28-33` to attach `SensitiveDataFilter` to logging **handlers** rather than to loggers — Python applies a logger's filters only in `Logger.handle()` on the originating logger, while `callHandlers()` applies handler filters to every propagated record (FR-026)
- [x] T058 [US4] Ensure at least one handler exists before attaching, so a process started without `basicConfig` still gets redaction; keep `SensitiveDataFilter`'s existing regex behaviour unchanged (FR-026, FR-027)
- [x] T059 [US4] Confirm the existing self-redacting log sites still behave identically: `_sanitized_db_error` (`apps/api/app/core/auth.py:40-47`), `_redact_secret` / `_sanitized_response_body` (`apps/api/app/services/storage.py:59-71`), and the webhook logs at `apps/api/app/routes/support_purchases.py:228,304,872,958`

**Checkpoint**: Redaction is effective for every application logger.

---

## Phase 7: User Story 5 — Token verification rejects unexpected algorithms safely (Priority: P2)

**Goal**: Determine accepted signing algorithms from trusted key material rather than the
caller-supplied token header, and stop returning unhandled 500s to unauthenticated callers.

**Independent Test**: Tokens declaring an unexpected, mismatched, or malformed algorithm all return
`401` with zero `5xx`; a legitimate token is still accepted.

### Tests for User Story 5 (write first, confirm they FAIL)

- [ ] T060 [P] [US5] Write **JW-1**, **JW-2**, **JW-4** in `apps/api/tests/test_jwt_algorithm_pinning.py`: tokens with `alg: none`, an unknown `alg`, and a malformed/absent `alg` each return `401` (FR-028, FR-029, SC-013)
- [ ] T061 [P] [US5] Write **JW-3** and **JW-8** in `apps/api/tests/test_jwt_algorithm_pinning.py`: a token with `alg: HS256` when only JWKS material is configured returns `401` and **not** `500` — this is the current defect, an unhandled `TypeError` from PyJWT's `force_bytes` on a public-key object; and no malformed-token path returns any `5xx` (FR-029, SC-013)
- [ ] T062 [P] [US5] Write **JW-5**, **JW-6**, **JW-7** in `apps/api/tests/test_jwt_algorithm_pinning.py`: a legitimately issued token is still accepted, and Supabase `anon` and `service_role` keys presented as bearer tokens are still rejected `401` (they carry no `sub`/`email`) — these guard an existing positive property that must not regress while verification code is edited (FR-028)

### Implementation for User Story 5

- [ ] T063 [US5] Rewrite the algorithm selection in `apps/api/app/core/auth.py:105-121`: gate the HS256 branch on `settings.supabase_jwt_secret` being present and pass a fixed `algorithms=["HS256"]`; for the JWKS branch derive the algorithm from the **resolved JWK's** own `alg`/`kty`, falling back to a fixed `["ES256", "RS256"]` allow-list — never from `header["alg"]` (FR-028)
- [ ] T064 [US5] Add `TypeError` to the caught exception tuple at `apps/api/app/core/auth.py:122` so a key/algorithm mismatch surfaces as `401` rather than an unhandled 500 (FR-029)
- [ ] T065 [US5] Confirm the `sub`/`email` presence checks at `apps/api/app/core/auth.py:125-126` and `:197-199` are unchanged, preserving rejection of anon and service-role keys (FR-028)

**Checkpoint**: Algorithm selection is server-controlled; no unauthenticated 500 path remains.

---

## Phase 8: User Story 6 — Minimal production surface and no extra disclosure (Priority: P2)

**Goal**: Close the docs surface in production, make diagnostics fail closed on an absent
environment identity, and stop `/health` from spending a service-role credential and a worker thread
on every probe.

**Independent Test**: With `APP_ENV=production` and with `APP_ENV` unset, the docs paths are
unavailable and no error response carries diagnostic detail; with `APP_ENV=dev` they are available.
`/health` answers promptly with an unroutable `SUPABASE_URL`.

### Tests for User Story 6 (write first, confirm they FAIL)

- [ ] T066 [P] [US6] Write **PS-1**, **PS-2**, **PS-3** in `apps/api/tests/test_production_surface.py`: `/docs`, `/redoc`, `/openapi.json` return `404` with `APP_ENV=production` **and** with `APP_ENV` unset, and are available with `APP_ENV=dev` — the unset case is the important one, an absent variable must select the safe behaviour (FR-030, SC-014)
- [ ] T067 [P] [US6] Write **PS-4**, **PS-5** in `apps/api/tests/test_production_surface.py`: an error response carries no `diagnostic` field with `APP_ENV=production` and with `APP_ENV` unset (FR-031, SC-014)
- [ ] T068 [P] [US6] Write **PS-6**, **PS-7**, **PS-8** in `apps/api/tests/test_production_surface.py`: `/health` makes zero outbound network requests (assert a patched HTTP layer was never called), never reads `SUPABASE_SERVICE_ROLE_KEY`, and responds promptly without blocking a worker thread (FR-032, FR-033, SC-015)

### Implementation for User Story 6

- [ ] T069 [US6] Add a shared environment predicate to `apps/api/app/core/config.py` returning dev/test status from `APP_ENV`, treating unset and unrecognised values as **not** dev/test so both consumers fail closed (FR-031)
- [ ] T070 [US6] Refactor `_is_test_or_dev_mode()` in `apps/api/app/core/auth.py:30-37` to delegate to the shared predicate, preserving the existing `PYTEST_CURRENT_TEST` behaviour so the test suite keeps its diagnostics (FR-031)
- [ ] T071 [US6] Pass `docs_url=None, redoc_url=None, openapi_url=None` to the `FastAPI(...)` constructor at `apps/api/app/main.py:28` unless the shared predicate reports dev/test (FR-030)
- [ ] T072 [US6] Rewrite `apps/api/app/routes/health.py:16-31`: delete `_database_status()` and its `urlopen` call, remove all use of `SUPABASE_SERVICE_ROLE_KEY`, and make the route `async def` returning process liveness only (FR-032, FR-033)
- [ ] T073 [US6] Apply the T008 finding: if an existing test asserts on `/health`'s `dependencies.database` payload or on `/openapi.json`, either update that test as part of this phase and record the change explicitly in `specs/018-security-remediation-hardening/contracts/security-regression-tests.md`, or keep a statically-computed `dependencies` shape — do not let it break silently (FR-039)
- [ ] T074 [US6] Update `apps/api/.env.example` and `docs/deployment.md` to document that `APP_ENV` must be explicitly set to `production` in deployed environments and that leaving it unset is safe but not recommended (FR-031)

**Checkpoint**: Production surface minimised; all hardening stories complete.

---

## Phase 9: User Story 7 + posture cleanup (Priority: P3) — ⚠️ OUTSIDE THE RELEASE GATE, DROPPABLE

**Goal**: Close the residual ability to query an arbitrary account's role in a *known* workspace, and
tighten two default-`PUBLIC` grants.

**⚠️ THIS PHASE MAY BE SKIPPED ENTIRELY.** It is not a release gate (spec FR-034, FR-035). If any
task here cannot be completed cleanly, **abandon the phase and document the residual risk** rather
than forcing it — spec User Story 7 acceptance scenario 4 explicitly permits this.

**⚠️ HIGHEST-RISK PHASE IN THE PLAN.** Unlike Phase 3, these two helpers carry ~55 references
including **five plpgsql body references** that fail at *runtime*, not at migration time, reaching AI
settings management and AI extraction confirmation.

**Independent Test**: Both helpers are unreachable directly, and the full role-permission and
tenant-isolation suites plus AI settings and extraction confirm all still pass unchanged.

- [ ] T075 [US7] Re-derive the complete reference inventory for `workspace_role_for` and `is_workspace_member` from `specs/018-security-remediation-hardening/data-model.md` §1 "Deferred inventory" and confirm it still matches the code, including the single **unqualified** reference at `supabase/migrations/20260722000000_hierarchical_categories.sql:239`
- [ ] T076 [US7] Write the Group **EX** extension in `apps/api/tests/test_private_schema_exposure.py` asserting both helpers return 404 over PostgREST after relocation, plus the RG-9/RG-10 preconditions as explicit pre/post assertions
- [ ] T077 [US7] Create `supabase/migrations/20260732000000_private_schema_rls_helpers.sql` with guarded relocations of `workspace_role_for(uuid,uuid)` and `is_workspace_member(uuid,uuid)`, plus `grant execute` retained for `authenticated` — do **NOT** revoke `EXECUTE`, which would disable every RLS policy and take the product down (FR-011, FR-034)
- [ ] T078 [US7] In the same migration, `create or replace` all **five** dependent bodies with the new qualification: `is_workspace_member` (`20260624000000...:70`), `set_workspace_ai_key` (`20260704000000...:42`), `clear_workspace_ai_key` (`20260704000000...:118`), `get_workspace_ai_key_for_extraction` (`20260705000000...:113`), and `confirm_ai_extraction` (`20260720010000...:50`) — missing any one breaks that flow silently at runtime (FR-004, FR-034)
- [ ] T079 [US7] Run RG-1, RG-2, RG-9, RG-10 plus the AI settings configure/replace/remove and extraction-confirm flows; if any fail, revert this migration and record the residual risk in `specs/018-security-remediation-hardening/spec.md` Assumptions rather than forcing the change (FR-034, SC-006, SC-009)
- [ ] T080 [P] Tighten the default-`PUBLIC` grant on `public.receipt_object_workspace_id(text)` in a migration: `revoke all ... from public, anon` then `grant execute ... to authenticated` — `authenticated` MUST retain `EXECUTE` because `storage.objects` policies call it at `supabase/migrations/20260702000000_receipt_invoice_storage.sql:146,156,166,171,181` (FR-035)
- [ ] T081 [P] Tighten the default-`PUBLIC` grant on `public.validate_category_assignment(uuid,uuid,text)` the same way, retaining `EXECUTE` for `authenticated` since trigger bodies call it (FR-035)

**Checkpoint**: Residual exposure closed, or explicitly documented as accepted.

---

## Phase 10: User Story 8 — Build pipeline pinning and dependency audit (Priority: P3) — DROPPABLE

**Goal**: Resolve third-party build steps to immutable versions and check dependencies for known
published vulnerabilities.

**⚠️ Lowest priority by explicit direction; not a release gate.**

**Independent Test**: Every third-party action in the pipeline references a commit SHA; a dependency
audit step runs and reports findings.

- [ ] T082 [P] [US8] Pin every third-party action in `.github/workflows/ci.yml` to a full commit SHA with a version comment: `actions/checkout@v4` (lines 16, 110), `actions/setup-python@v5` (18, 112), `actions/setup-node@v4` (24, 118), `supabase/setup-cli@v1` (30, 124), `actions/upload-artifact@v4` (96, 198) (FR-036)
- [ ] T083 [P] [US8] Add a non-blocking dependency audit step to `.github/workflows/ci.yml` running `pip-audit` against `apps/api/requirements.txt` and `npm audit --audit-level=high`, with `continue-on-error: true` so it reports without blocking unrelated work (FR-036)
- [ ] T084 [P] [US8] Create `.github/dependabot.yml` covering the `pip` ecosystem at `apps/api/`, the `npm` ecosystem at the repository root, and `github-actions`, on a weekly schedule (FR-036)

**Checkpoint**: Supply-chain hygiene improved.

---

## Phase 11: Polish, Release Gates & Verification

**Purpose**: Whole-phase verification and the gates that cannot be automated.

- [ ] T085 Run the complete backend suite `cd apps/api && python -m pytest tests/ -q` and diff against `specs/018-security-remediation-hardening/baseline-pytest.txt`; confirm every pre-existing test passes with **no assertion modified**, and explicitly list any test that had to change with its justification (FR-039, SC-017)
- [ ] T086 [P] Run `npm run test --workspace=@smart-expense/web` and `cd apps/web && npx playwright test e2e --workers=1`; confirm no frontend regression from the new message key (FR-039, SC-019)
- [ ] T087 [P] Run **MG-1**: apply `supabase/migrations/20260731000000_private_schema_privileged_functions.sql` twice in succession and confirm the contract's verification queries return identical results (FR-012, SC-016)
- [ ] T088 [P] Run **MG-2**: execute `specs/018-security-remediation-hardening/rollback.sql` against a disposable database and confirm the four functions return to `public` with their original grants and the app still works (FR-013, SC-016)
- [ ] T089 [P] Run **MG-3**: confirm Section A and Section B of `rollback.sql` can each be applied without the other (FR-014)
- [ ] T090 [P] Run **MG-4** and **MG-5** static gates: `grep -icE 'create policy|drop policy|create table|alter table'` on the migration returns 0, and grepping `apps/api/app` for `public.ensure_personal_workspace|public.find_user_profile_by_email|public.get_workspace_ai_key_for_extraction|public.shares_workspace_with` returns no matches (FR-004, FR-005, FR-010, SC-006)
- [ ] T091 Execute quickstart Steps 1–9 from `specs/018-security-remediation-hardening/quickstart.md` and record each expected/actual result, including the EX-5 control check in Step 1 and the co-member visibility check in Step 4h that exercises the relocated `shares_workspace_with` through its RLS policy
- [ ] T092 **RELEASE GATE — cannot be automated**: execute quickstart Step 10; confirm the target deployment environment's exposed-schema list is `public, graphql_public` and excludes `private`; attach a screenshot or API-settings dump as evidence to the release record (FR-038, SC-018)
- [ ] T093 **RELEASE GATE** — run the deployed smoke assertion from quickstart Step 10: `POST {DEPLOYED_URL}/rest/v1/rpc/ensure_personal_workspace` with a real user token returns `404`; this is the only check that catches hosted dashboard drift (FR-038, SC-018)
- [ ] T094 [P] Update `docs/deployment.md` with a Phase 18 operational section: the `private` schema exists and must never be added to exposed schemas; `APP_ENV` must be set to `production`; rate-limit allowances are per instance; `rollback.sql` location and usage
- [ ] T095 [P] Add a short "Phase 18 security posture" note to `supabase/README.md` recording that privileged routines live in `private` and that `EXECUTE` must never be revoked from `authenticated` on the RLS helpers
- [ ] T096 Confirm the Phase 17 non-goals were respected: `specs/017-product-support-purchases/tasks.md:215` **T052 remains unchecked**, no live Stripe/Apple/Google sandbox testing is claimed anywhere in this phase's artifacts, and the placeholder price IDs at `apps/api/app/core/support_tiers.py:25,34,43` are untouched
- [ ] T097 Record final phase status in `specs/018-security-remediation-hardening/spec.md`: change **Status** from `Draft` to `Implemented`, and state explicitly whether Phase 9 (User Story 7) was completed or dropped so the residual risk is not silently implied to be closed

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Proof)                    ← HARD BLOCKER for Phase 3+
   ↓
Phase 2 (Foundational)             ← baseline + inventory; blocks Phase 3+
   ↓
Phase 3 (US1, P1) ─────────────────← RELEASE BLOCKER; MVP increment
   ↓
Phase 4 (US2, P1) ─────────────────← RELEASE BLOCKER; shares the same migration file as Phase 3
   ↓
Phase 5 (US3) ┐
Phase 6 (US4) ├── all P2, mutually independent, may run in parallel
Phase 7 (US5) │
Phase 8 (US6) ┘
   ↓
Phase 9 (US7, P3)  ← DROPPABLE, outside release gate
Phase 10 (US8, P3) ← DROPPABLE, outside release gate
   ↓
Phase 11 (Polish & Release Gates)
```

### Critical sequencing notes

- **Phase 1 → Phase 3 is a hard blocker.** T016 must not be written until T004 records the proof.
- **Phase 3 and Phase 4 share one migration file** (`20260731000000_...sql`). T032 appends Step 6 to
  the file T016–T020 created, so Phase 4 cannot run in parallel with Phase 3 despite both being P1.
- **Phase 2's T008 gates T073** in Phase 8.
- **Phase 2's T007 baseline gates T027, T085.** Without it there is no before-image.
- Phases 5–8 touch disjoint files and are genuinely independent of one another.
- **Phase 9 must run after Phase 3**, never instead of it, and must be reverted rather than forced if
  T079 fails.

### Parallel Opportunities

- Phase 2: T006, T008, T009, T010 all parallel
- Phase 3: tests T011–T015 parallel; call sites T021–T024 parallel; migration steps T016–T020
  sequential (same file)
- Phase 4: tests T028–T031 parallel
- Phase 5: tests T036–T041 parallel; route attachments T046–T048 parallel; message files T051, T052
  parallel
- Phases 5, 6, 7, 8 can run concurrently across developers
- Phase 10: T082, T083, T084 parallel
- Phase 11: T086–T090 parallel; T094, T095 parallel

---

## Implementation Strategy

### Minimum releasable scope (recommended stopping point for a first PR)

1. Phase 1 — prove the mechanics
2. Phase 2 — baseline and inventory
3. Phase 3 — US1, all four vulnerabilities closed at the exposure layer
4. Phase 4 — US2, the independent identity guard
5. Phase 11 tasks T085, T087–T093 — regression, migration safety, and the two manual release gates

That set removes both production blockers (C1 and H1) and is independently shippable. Phases 5–8 are
hardening that should follow promptly but do not block the security fix.

### Incremental delivery

- **PR 1** — Phases 1–4 + the Phase 11 gates. Unblocks production.
- **PR 2** — Phases 5–8. Hardening.
- **PR 3** — Phases 9–10, if attempted at all.

### What must NOT happen

- No task may revoke `EXECUTE` from `authenticated` on `workspace_role_for` or `is_workspace_member`
  (spec FR-011). This would disable every RLS policy in the database.
- No task may add `private` to `supabase/config.toml`'s `schemas` list.
- No task may introduce the service-role key into a relocated function's call path (spec FR-003).
- No reversal SQL may be placed in `supabase/migrations/`.
- Phase 17's T052 must not be completed or marked complete (spec Out of Scope).

---

## Requirements Traceability

Every requirement and success criterion maps to at least one task.

| Req | Tasks |
|---|---|
| FR-001 | T011, T016, T017 |
| FR-002 | T011, T016, T017 |
| FR-003 | T014, T016 |
| FR-004 | T006, T019, T078, T090 |
| FR-005 | T021, T022, T023, T024, T090 |
| FR-006 | T019, T032 |
| FR-007 | T014, T018 |
| FR-008 | T028, T029, T030, T031, T032, T033 |
| FR-009 | T013 |
| FR-010 | T015, T027, T090 |
| FR-011 | T014, T020, T077 |
| FR-012 | T015, T017, T087 |
| FR-013 | T025, T088 |
| FR-014 | T025, T034, T089 |
| FR-015 | T002, T003, T004 |
| FR-016 | T017, T032 |
| FR-017 | T036, T044 |
| FR-018 | T037, T046, T047, T048 |
| FR-019 | T036, T043 |
| FR-020 | T036, T045 |
| FR-021 | T038, T049 |
| FR-022 | T040, T050 |
| FR-023 | T042, T053 |
| FR-024 | T039, T043 |
| FR-025 | T041, T051, T052 |
| FR-026 | T054, T056, T057, T058 |
| FR-027 | T055, T058 |
| FR-028 | T060, T062, T063, T065 |
| FR-029 | T061, T064 |
| FR-030 | T066, T071 |
| FR-031 | T067, T069, T070, T074 |
| FR-032 | T068, T072 |
| FR-033 | T068, T072 |
| FR-034 | T075, T077, T078, T079 |
| FR-035 | T080, T081 |
| FR-036 | T082, T083, T084 |
| FR-037 | T011, T012, T013, T014 |
| FR-038 | T092, T093 |
| FR-039 | T027, T073, T085, T086 |

| SC | Tasks |
|---|---|
| SC-001 | T011, T012 |
| SC-002 | T011, T028 |
| SC-003 | T011 |
| SC-004 | T011 |
| SC-005 | T013, T027 |
| SC-006 | T015, T027, T079, T090 |
| SC-007 | T030, T031, T035 |
| SC-008 | T027 |
| SC-009 | T027, T079 |
| SC-010 | T037 |
| SC-011 | T038 |
| SC-012 | T054, T055 |
| SC-013 | T060, T061 |
| SC-014 | T066, T067 |
| SC-015 | T068 |
| SC-016 | T087, T088 |
| SC-017 | T085 |
| SC-018 | T092, T093 |
| SC-019 | T041, T052, T086 |

---

## Notes

- **97 tasks total.** Release-blocking scope is Phases 1–4 plus the Phase 11 gates (T001–T035,
  T085, T087–T093) = **44 tasks**. Phases 9–10 (T075–T084, 10 tasks) are droppable.
- `[P]` = different files, no dependency on an incomplete task.
- **T080 and T081 deliberately carry no `[US*]` label.** They implement FR-035 (tightening two
  default-`PUBLIC` grants), which maps to no user story — it is posture cleanup surfaced during
  research (R-012). They sit in Phase 9 because they share that phase's droppable, outside-the-gate
  status, not because they belong to User Story 7.
- Migration steps within `20260731000000_...sql` are sequential because they edit one file.
- Tests are written before implementation within each phase and must be confirmed failing first.
- The highest-consequence tasks are **T019** (missing it breaks every signup at runtime while the
  migration reports success), **T030** (catches a non-NULL-tolerant identity guard), **T012**
  (prevents the exposure tests passing vacuously), and **T092** (the only gate that catches hosted
  dashboard drift).
