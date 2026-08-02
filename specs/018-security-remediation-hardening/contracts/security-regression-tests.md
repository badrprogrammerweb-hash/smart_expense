# Contract: Security Regression Tests

**Feature**: `018-security-remediation-hardening` | **Date**: 2026-07-30

Required assertions, each mapped to the requirement and success criterion it discharges. This is the
suite spec FR-037 requires: it must **fail** if any relocated routine becomes directly reachable
again.

Convention: new modules go in `apps/api/tests/` as flat `test_*.py`, matching the existing layout.
Existing suites are the regression baseline — **their assertions must not be modified** (spec FR-039).

---

## Group EX — Direct RPC exposure (`test_private_schema_exposure.py`)

The core release-gate assertions. These must call the **PostgREST HTTP API** with an ordinary user's
access token plus the anon key — *not* the database directly, and *not* the FastAPI backend. Testing
via `psql` would prove nothing: the vulnerability is HTTP reachability, and `authenticated` still
holds `EXECUTE` by design.

| ID | Assertion | FR | SC |
|---|---|---|---|
| EX-1 | `POST /rest/v1/rpc/ensure_personal_workspace` with a valid user token → **404**, and the target profile's email is unchanged | FR-001, FR-002 | SC-001, SC-002 |
| EX-2 | `POST /rest/v1/rpc/get_workspace_ai_key_for_extraction` as a **Member** of a BYOK-configured workspace → **404**, response body contains no `sk-`/`AIza` material | FR-001, FR-009 | SC-001, SC-005 |
| EX-3 | `POST /rest/v1/rpc/find_user_profile_by_email` for another account's address → **404**, no id or email returned | FR-001 | SC-001, SC-003 |
| EX-4 | `POST /rest/v1/rpc/shares_workspace_with` with two arbitrary user ids → **404** | FR-001 | SC-001, SC-004 |
| EX-5 | Control: `POST /rest/v1/rpc/<a still-public safe function>` still succeeds, proving the 404s are relocation-specific and not a broken test harness | — | — |
| EX-6 | `authenticated` **retains** `USAGE` on `private` and `EXECUTE` on all four relocated functions | FR-003, FR-007 | — |
| EX-7 | Phase 3 precondition: before optional Phase 9, `public.workspace_role_for` and `public.is_workspace_member` remain executable by `authenticated`; Phase 9 red evidence must capture this state | FR-011, FR-034 | — |
| EX-8 | After Phase 9, ordinary-user calls to `POST /rest/v1/rpc/workspace_role_for` and `POST /rest/v1/rpc/is_workspace_member` both return **404** | FR-034 | SC-001, SC-006 |
| EX-9 | Each exact helper signature exists once in `private`, not in `public`; `authenticated` retains EXECUTE while `anon` and PUBLIC do not | FR-011, FR-034 | SC-006 |
| EX-10 | Live `pg_policy` dependencies follow both helper OIDs into `private`, and owner/member/outsider workspace visibility remains unchanged | FR-034 | SC-006 |
| EX-11 | `receipt_object_workspace_id` and `validate_category_assignment` remain in `public` with authenticated-only EXECUTE; direct local Storage API access still permits a member and denies an outsider | FR-035 | SC-006 |

**EX-5 is not optional.** Without it, a harness misconfiguration that 404s every RPC would make
EX-1..4 pass vacuously.

---

## Group ID — Identity guard (`test_identity_guard.py`)

| ID | Assertion | FR | SC |
|---|---|---|---|
| ID-1 | Called **directly** with `request.jwt.claims` set to user A and `target_user_id` = user B → raises `42501`, and B's `user_profiles.email` is unchanged | FR-008 | SC-002 |
| ID-2 | Called directly with claims = A and `target_user_id` = A → succeeds | FR-008 | SC-007 |
| ID-3 | Called with **no** request context (`auth.uid()` NULL), as the trigger path does → succeeds | FR-008 | SC-007 |
| ID-4 | A new `auth.users` insert still creates the personal workspace with the account as Owner | FR-008 | SC-007 |
| ID-5 | An account whose stored email drifts from its session email has its **own** email corrected on the next request | FR-008 | SC-007 |

**ID-1 must invoke the routine directly, not through an endpoint.** `_repair_personal_workspace`
(`core/auth.py:147-152`) catches `DBAPIError` and returns early when `_personal_workspace_exists` is
true, so a `42501` raised through the endpoint would be swallowed and the test would pass without
exercising the guard.

**ID-3 and ID-4 are the highest-value tests in this group** — they are what catch a guard written as
`auth.uid() = target_user_id`, which would break every new signup.

---

## Group RL — Rate limiting (`test_rate_limits.py`)

| ID | Assertion | FR | SC |
|---|---|---|---|
| RL-1 | Each bucket refuses at allowance + 1 with `429` and `code == "rate_limited"` | FR-017, FR-019 | — |
| RL-2 | A throttled checkout creates **zero** new `support_purchases` rows and makes **zero** Stripe calls (assert on a mocked provider that it was never invoked) | FR-018 | SC-010 |
| RL-3 | A throttled mobile verify makes **zero** Apple/Google verification calls | FR-018 | SC-010 |
| RL-4 | A throttled AI request makes **zero** provider calls **and** never reads the BYOK key | FR-018 | SC-010 |
| RL-5 | Account A throttled leaves account B unaffected | FR-020 | — |
| RL-6 | After the window elapses, the next request succeeds | FR-017 | — |
| RL-7 | All three webhook routes accept a burst well beyond any allowance | FR-021 | SC-011 |
| RL-8 | A limiter internal error results in refusal, not passage | FR-024 | — |
| RL-9 | The refusal message discloses neither threshold nor remaining window, and no `Retry-After` is sent | FR-019 | — |
| RL-10 | Two identical rapid checkout submissions produce **one** Checkout Session, not two | FR-022 | — |
| RL-11 | `errors.rateLimited` exists in **both** `en.json` and `ar.json` and neither is empty | FR-025 | SC-019 |
| RL-12 | An unauthenticated request to a throttled route returns `401`, not `429` | FR-020 | — |

**RL-2/RL-3/RL-4 are the ordering proof.** They are what verify the claim that a route-level
dependency resolves before `get_trusted_session` and before the endpoint body. Do not replace them
with a check that merely asserts the status code is 429.

---

## Group LG — Log redaction (`test_log_redaction.py`)

| ID | Assertion | FR | SC |
|---|---|---|---|
| LG-1 | A bearer credential logged via `logging.getLogger("app.services.storage")` appears redacted in handler output | FR-026 | SC-012 |
| LG-2 | An email logged via a module-level logger appears masked | FR-026 | SC-012 |
| LG-3 | Sensitive content passed as a **formatting argument** (`logger.warning("x: %s", secret)`) is redacted | FR-027 | SC-012 |
| LG-4 | Output from the top-level logger is still redacted (no regression) | FR-026 | SC-012 |
| LG-5 | An already-self-redacted message is not doubly mangled | FR-026 | — |

**LG-1 is the test that would have failed before this phase** and is the reason the group exists.
Assert on captured **handler** output, not on the `LogRecord` object — attaching a filter to a logger
still mutates a record if you log directly on that logger, so asserting on the record can pass while
real output is unredacted.

---

## Group JW — Token algorithm pinning (`test_jwt_algorithm_pinning.py`)

| ID | Assertion | FR | SC |
|---|---|---|---|
| JW-1 | A token with `alg: none` → `401` | FR-028, FR-029 | SC-013 |
| JW-2 | A token with an unknown `alg` → `401` | FR-028, FR-029 | SC-013 |
| JW-3 | A token with `alg: HS256` when only JWKS material is configured → **`401`, not `500`** | FR-029 | SC-013 |
| JW-4 | A token with a malformed/absent `alg` → `401` | FR-029 | SC-013 |
| JW-5 | A legitimately issued token is still accepted | FR-028 | — |
| JW-6 | A Supabase `anon` key presented as a bearer token → `401` (no `sub`/`email`) | — | — |
| JW-7 | A Supabase `service_role` key presented as a bearer token → `401` | — | — |
| JW-8 | No path returns `5xx` for any malformed token in JW-1..4 | FR-029 | SC-013 |

**JW-3 is the specific defect** — today it produces an unhandled `TypeError` → `500`. **JW-6/JW-7
guard an existing positive property** that must not regress while the verification code is edited.

---

## Group PS — Production surface (`test_production_surface.py`)

| ID | Assertion | FR | SC |
|---|---|---|---|
| PS-1 | With `APP_ENV=production`: `/docs`, `/redoc`, `/openapi.json` → `404` | FR-030 | SC-014 |
| PS-2 | With `APP_ENV=dev`: all three available | FR-030 | SC-014 |
| PS-3 | With `APP_ENV` **unset**: all three unavailable (safe default) | FR-030, FR-031 | SC-014 |
| PS-4 | With `APP_ENV=production`: an error response carries no `diagnostic` field | FR-031 | SC-014 |
| PS-5 | With `APP_ENV` **unset**: no `diagnostic` field (fail closed) | FR-031 | SC-014 |
| PS-6 | `/health` makes zero outbound network requests (assert a patched HTTP layer was never called) | FR-032 | SC-015 |
| PS-7 | `/health` never reads `SUPABASE_SERVICE_ROLE_KEY` | FR-032 | SC-015 |
| PS-8 | `/health` responds promptly and does not block a worker thread | FR-033 | — |

**PS-3 and PS-5 are the important rows** — an absent environment variable must select the *safe*
behaviour, never require opting in.

**Pre-work task**: before implementing, grep the existing suites for assertions on `/openapi.json`,
`/docs`, or `/health`'s current `dependencies.database` payload. `test_acc_readiness_smoke.py` is the
likely candidate. Removing that payload must not silently break a passing test — if one exists,
either the test is updated as part of this phase with the change recorded, or `/health` keeps a
statically-computed `dependencies` shape.

### Group PS pre-work (T008 — 2026-08-01)

**Original Codex T008 search scope** was limited to `apps/api/tests/` and `apps/web/tests/`:

```powershell
rg -n -i -e 'openapi' -e 'docs' -e 'redoc' -e 'dependencies' -e 'health' apps/api/tests
rg -n -i -e 'openapi' -e 'docs' -e 'redoc' -e 'dependencies' -e 'health' apps/web/tests
```

| Current test location | Current assertion / relevance | Affected by docs-surface change? | Affected by `/health` payload change? | Expected Phase 8 action |
|---|---|---|---|---|
| `apps/api/tests/test_categories_migration_backfill.py:43,78-80,141` | Uses `health` only as a category slug/name; it does not call the health endpoint or assert its response. | No | No | No change |
| `apps/api/tests/test_categories_manage.py:25` | Uses `Health` only as a category name; it does not call the health endpoint or assert its response. | No | No | No change |
| `apps/web/tests/` | No matches for any requested term. | No existing assertion | No existing assertion | Replace missing coverage with the planned PS-1–PS-8 production-surface tests |

The original scope did not include `apps/web/e2e/` or colocated web `__tests__/` directories.

**Readiness-smoke correction**: `apps/api/tests/acceptance/test_acc_readiness_smoke.py` exists and
is collected by pytest: `apps/api/pytest.ini` includes both `tests` and `tests/acceptance`, and the
file follows the `test_*.py` naming convention. Its test exercises dashboard/report reconciliation;
it contains no assertions about `/health`, `/docs`, `/redoc`, `/openapi.json`, `dependencies`, or a
health response shape. Phase 8 therefore needs to add new Group PS coverage rather than modify this
test.

**Review follow-up verification (broader than the original Codex scope)** searched:

```powershell
rg -n -i -e '/health' -e '/docs' -e '/redoc' -e '/openapi\.json' -e '\bdependencies\b' -e 'health.*response|response.*health' apps/web/e2e
rg -n -i -g '!**/node_modules/**' -g '!**/.next/**' -g '**/__tests__/**' -e '/health' -e '/docs' -e '/redoc' -e '/openapi\.json' -e '\bdependencies\b' -e 'health.*response|response.*health' apps/web/components apps/web/lib
rg -n -i -g '!**/node_modules/**' -g '!**/.next/**' -g '**/*.{test,spec}.{ts,tsx,js,jsx}' -e '/health' -e '/docs' -e '/redoc' -e '/openapi\.json' -e '\bdependencies\b' -e 'health.*response|response.*health' apps/web
```

This follow-up covers `apps/web/e2e/`, `apps/web/components/**/__tests__/`,
`apps/web/lib/**/__tests__/`, and other relevant named web test/spec files (including
`apps/web/tests/unit/` and `apps/web/tests/e2e/`). No relevant references were found for `/health`,
`/docs`, `/redoc`, `/openapi.json`, `dependencies`, or a health response shape. No current test
requires modification; Phase 8 must add the planned Group PS coverage.

---

## Group RG — Unchanged-behaviour regression

No new module. These are **existing** suites that must pass with **no assertion modified**
(spec FR-039). Run them before and after and diff the outcomes.

| ID | Suite | Proves | SC |
|---|---|---|---|
| RG-1 | `tests/acceptance/test_acc_tenant_isolation.py` | Cross-workspace isolation unchanged | SC-006 |
| RG-2 | `tests/acceptance/test_acc_role_permissions.py` | Owner/Admin/Member/Viewer decisions unchanged | SC-006 |
| RG-3 | `tests/acceptance/test_acc_financial_accuracy.py` | No financial change | SC-017 |
| RG-4 | `tests/acceptance/test_acc_file_privacy.py` | File privacy unchanged | SC-017 |
| RG-5 | `tests/acceptance/test_acc_ai_behavior.py` | AI behaviour unchanged | SC-009 |
| RG-6 | `tests/test_ai_settings_secrecy.py`, `tests/test_extraction_secrecy.py` | Raw key still never surfaces | SC-005 |
| RG-7 | `tests/test_signup_bootstrap.py` | Bootstrap + repair still work | SC-007 |
| RG-8 | `tests/test_workspace_members*.py` | Invite-by-email still resolves correctly | SC-008 |
| RG-9 | `tests/test_ai_settings_*.py` (configure/replace/remove) | Vault write path unaffected | SC-009 |
| RG-10 | `tests/test_extraction_confirm*.py` | Extraction confirm unaffected | SC-009 |
| RG-11 | `tests/test_support_purchase*.py` + webhook tests | Purchase and webhook behaviour unchanged | SC-017 |
| RG-12 | `apps/web` Playwright suite | No frontend regression from the new message key | SC-019 |

RG-9 and RG-10 matter specifically because their routines' bodies reference
`public.workspace_role_for` — they are the suites that would fail first if the deferred helpers were
moved by mistake.

---

## Group MG — Migration safety (`test_private_schema_exposure.py` or its own module)

| ID | Assertion | FR | SC |
|---|---|---|---|
| MG-1 | The migration applied twice in succession yields the same end state | FR-012 | SC-016 |
| MG-2 | `rollback.sql` restores the prior schema and grants on a disposable database | FR-013 | SC-016 |
| MG-3 | Relocation and identity guard are independently reversible | FR-014 | — |
| MG-4 | The migration file contains zero `create policy` / `drop policy` / `create table` / `alter table` statements | FR-010 | SC-006 |
| MG-5 | Grep of `apps/api` finds no remaining `public.` call site for the four relocated functions | FR-004, FR-005 | — |
| MG-6 | `on_auth_user_created` trigger still exists after `handle_new_user` is re-created | FR-004 | SC-007 |

MG-4 and MG-5 are cheap static checks with high value — MG-4 is the single best proof that tenant
isolation was not touched, and MG-5 catches a missed call site that would otherwise surface as a
runtime failure in production.

---

## Phase 3 local regression evidence

- **Timestamp**: 2026-08-02 02:20:23 +03:00
- **Branch / HEAD**: `018-security-remediation-hardening` /
  `e0c608f23b051d6c9547ab84b14df56f2dce1403`
- **Interpreter**: project virtual environment, `.venv\Scripts\python.exe`
- **Environment**: local Supabase only; no hosted service or external provider was contacted.

### Required pre-implementation red run

Exact command (from `apps/api`):

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_private_schema_exposure.py tests/test_migration_safety.py -q
```

Raw relevant output and exit status:

```text
F.FFFFF.                                                                 [100%]
ensure_personal_workspace remains published through local PostgREST (status=204)
get_workspace_ai_key_for_extraction remains published through local PostgREST (status=200)
assert schema_usage is True
Missing Phase 3 migration: D:\claude\smart_expense\supabase\migrations\20260731000000_private_schema_privileged_functions.sql
Missing Phase 3 migration: D:\claude\smart_expense\supabase\migrations\20260731000000_private_schema_privileged_functions.sql
Left contains 4 more items, first extra item: 'apps\\api\\app\\core\\auth.py: public.ensure_personal_workspace'
6 failed, 2 passed in 21.13s
Exit code: 1
```

These failures were expected security-red evidence: the target RPCs were still published, the
private schema/grants and migration did not yet exist, and all four production call sites still used
their old public qualification. EX-5's public RPC control and MG-6's trigger-survival check passed,
showing that neither the local PostgREST harness nor the database connection was broken.

### Focused post-migration run

The same exact command ended with:

```text
........                                                                 [100%]
8 passed in 32.22s
Exit code: 0
```

Two preceding post-migration attempts reported `1 failed, 7 passed` because the newly written EX-6
catalog query initially retained PostgreSQL parameter names and then encoded its regex backreference
as a Python control character. The query representation was corrected without changing or weakening
the schema, signature, privilege, or exposure assertions. The final run above is authoritative.

### Required Group RG runs

All commands below ran from `apps/api` using the project virtual environment. Counts include no
skips; every command exited `0` after the two noted harness qualifications were corrected.

| Group | Exact pytest arguments | Result | Duration | Exit |
|---|---|---:|---:|---:|
| RG-1 | `tests/acceptance/test_acc_tenant_isolation.py -q` | 4 passed | 132.11s | 0 |
| RG-2 | `tests/acceptance/test_acc_role_permissions.py -q` | 2 passed | 64.02s | 0 |
| RG-6 | `tests/test_ai_settings_secrecy.py tests/test_extraction_secrecy.py -q` | 4 passed | 7.53s | 0 |
| RG-7 | `tests/test_signup_bootstrap.py -q` | 1 passed | 1.53s | 0 |
| RG-8 | `tests/test_workspace_members_role.py tests/test_workspace_members_remove.py tests/test_workspace_members_list.py tests/test_workspace_members_leave.py tests/test_workspace_members_add.py -q` | 5 passed | 26.57s | 0 |
| RG-9 | `tests/test_ai_settings_secrecy.py tests/test_ai_settings_replace.py tests/test_ai_settings_remove.py tests/test_ai_settings_manual_first.py tests/test_ai_settings_configure.py tests/test_ai_settings_authorization.py -q` | 7 passed | 16.52s | 0 |
| RG-10 | `tests/test_extraction_confirm_workspace_currency.py tests/test_extraction_confirm.py -q` | 6 passed | 15.39s | 0 |

The first RG-6 run was `1 failed, 3 passed in 7.77s`: its catalog query still filtered on
`n.nspname = 'public'`. Only that filter was requalified to `private`; the existing assertion that
exactly `get_workspace_ai_key_for_extraction` reads `vault.decrypted_secrets` was unchanged. The first
RG-7 run failed in 1.57s because the test fixture still called
`public.ensure_personal_workspace`; only that fixture call was requalified to `private`. Its signup
assertions were unchanged.

Supplemental T024 coverage ran:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_ai_summary.py tests/test_ai_summary_error_handling.py -q
```

Result: `2 passed in 6.01s`, exit `0`. Providers were mocked/local as defined by the tests.

### Baseline comparison and access decisions

T007's full-suite baseline remains `282 passed in 1180.36s (0:19:40)`, exit `0`. Phase 3 did not
rerun the entire 282-test suite; it ran the task-mandated focused tests and exact mapped RG suites, so
their aggregate counts are not directly comparable to the full-suite count. Every required mapped
suite and the supplemental AI-summary suite passed. No existing assertion was modified. RG-1 and
RG-2 preserve the prior non-member and Owner/Admin/Member/Viewer decisions; RG-6 preserves key
secrecy; RG-7 preserves signup/bootstrap; RG-8 preserves invite/member behavior; and RG-9/RG-10
preserve BYOK and extraction behavior. No access-decision drift was observed.

---

## Phase 4 local identity-guard evidence

- **Timestamp**: 2026-08-02 03:02:38 +03:00
- **Branch / HEAD**: `018-security-remediation-hardening` /
  `a903d76c1676b09284da54c4e85e975d6d6ef7e4`
- **Interpreter**: project virtual environment, `.venv\Scripts\python.exe`
- **Environment**: local Supabase only; generated users and emails were unique synthetic test data.

### Required pre-implementation red run

Exact command from `apps/api`:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_identity_guard.py -q
```

Authoritative result:

```text
F....                                                                    [100%]
FAILED test_mismatched_identity_is_refused_without_mutating_target
AssertionError: Cross-identity bootstrap call was accepted
1 failed, 4 passed in 6.84s
Exit code: 1
```

ID-1 used an explicit savepoint that was rolled back before querying B again. B's row existed and
its email exactly matched the captured pre-call value; the sole failure was that the pre-guard
function accepted the cross-identity call. ID-2 through ID-5 already passed, preserving the positive
behavior baseline.

An earlier diagnostic run produced the same intended ID-1 failure plus teardown errors because the
local Auth admin-delete route returned `500`: the project's last-owner protection prevents that
account-deletion cascade. The unsafe cleanup attempt was removed and the authoritative red run above
was repeated cleanly. Unique local synthetic test accounts remain because no safe supported cleanup
path exists; no baseline or non-Phase-4 account was modified.

### Post-implementation ID-1 through ID-5

The same exact command returned:

```text
.....                                                                    [100%]
5 passed in 6.02s
Exit code: 0
```

- **ID-1 PASS**: mismatched A → B call raised `identity_mismatch`, SQLSTATE `42501`, and B remained
  unchanged after savepoint recovery.
- **ID-2 PASS**: matching A → A call succeeded, repaired A's drifted email, and retained exactly one
  personal workspace and Owner membership.
- **ID-3 PASS**: direct invocation with `auth.uid() IS NULL` succeeded and performed self-repair.
- **ID-4 PASS**: local Auth signup exercised the real `on_auth_user_created` trigger and produced
  one profile, one personal workspace, and one Owner membership.
- **ID-5 PASS**: a normal authenticated `/workspaces` request repaired only the caller's drifted
  email; the comparison account remained unchanged.

### Phase 3 focused regression after Step 6

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_private_schema_exposure.py tests/test_migration_safety.py tests/test_extraction_secrecy.py -q
```

Result: `11 passed in 35.81s`, exit `0`. The direct PostgREST 404 checks, non-404 control, private
privileges, idempotent full migration replay, trigger binding, old-call-site scan, and BYOK secrecy
all remain green.

### T035 signup regression and browser Step 4a

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_signup_bootstrap.py -q
```

Result: `1 passed in 1.37s`, exit `0`.

The required true browser signup could not be executed: the browser-control runtime reported
`No browser is available`, and browser discovery returned an empty list (`[]`) even though the local
web application and API processes were running. Per T035, no API-only or database-only action was
substituted for the UI flow. The browser portion is therefore **BLOCKED / NOT COMPLETE**, and T035
remains unchecked.

---

## Phase 5 local rate-limit evidence

- **Timestamp**: 2026-08-02 03:44:32 +03:00
- **Branch / HEAD**: `018-security-remediation-hardening` /
  `f0caa5c83e5f8132c3e9833210a9bca4b7e92f55`
- **Environment**: project virtual environment and local ASGI/Supabase test environment only.
  Payment and AI providers were deterministic fakes; no hosted provider was called.

### Required pre-implementation red runs

From `apps/api`:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_rate_limits.py -q
```

Authoritative result: `13 failed, 2 passed in 2.25s`, exit `1` (wall `7.20s`). The four
allowance-plus-one requests were accepted, `app.core.rate_limit` was absent, forced internal failure
could not fail closed, and two identical checkout requests produced two fake Stripe sessions and two
logical purchases. RL-7 (unthrottled malformed-webhook bursts) and RL-12 (unauthenticated `401`)
already passed, protecting the existing behavior.

From `apps/web`:

```powershell
npm exec -- vitest run tests/unit/rate-limit-messages.test.ts
```

Result: `1 failed in 3.38s`, exit `1` (wall `7.53s`), because
`enMessages.errors.rateLimited` was undefined. The test checks both locales once the first assertion
passes.

### Focused Phase 5 green runs

The same backend command returned `15 passed in 1.40s`, exit `0` (wall `5.47s`). It proves:

- all four buckets accept their allowance and refuse allowance + 1 with the exact nondisclosing
  `429/rate_limited` envelope and no `Retry-After`;
- counters are account-isolated, roll after an injected monotonic hour, fail closed, admit exactly
  five concurrent final-slot attempts, and remain bounded at the configured entry cap;
- throttled requests do not resolve the operation database-session dependency or invoke the
  provider, BYOK/key-read, service, or state-mutation fakes; the synthetic checkout account retains
  zero database rows;
- Stripe, Apple, and Google webhook routes contain no limiter dependency and each accepted 35
  malformed-request bursts with its normal `400`, never `429`;
- two same-user/same-tier submissions inside the 60-second idempotency bucket created one fake
  Stripe Checkout Session and one logical purchase with consistent responses; a request 61 seconds
  later created the legitimate second session/purchase.

The message command returned `1 passed in 3.39s`, exit `0` (wall `5.95s`).

### Existing regressions

| Scope | Exact command | Result | Exit |
|---|---|---:|---:|
| Checkout, mobile verify, purchase state/isolation, webhooks, provider mocks | `.\.venv\Scripts\python.exe -m pytest tests/test_support_purchases_api.py tests/test_support_purchases_state.py tests/test_support_purchases_isolation.py tests/test_support_purchases_webhooks.py tests/test_payment_providers.py -q` | 102 passed in 61.79s | 0 |
| Extraction trigger/errors/secrecy and AI summary | `.\.venv\Scripts\python.exe -m pytest tests/test_extraction_trigger.py tests/test_extraction_error_handling.py tests/test_extraction_secrecy.py tests/test_ai_summary.py tests/test_ai_summary_error_handling.py -q` | 17 passed in 35.10s | 0 |
| Message parity/localization | `npm exec -- vitest run tests/unit/rate-limit-messages.test.ts tests/unit/localization-rtl.test.tsx` | 7 passed in 3.62s | 0 |
| Existing support-copy lint | `npm run lint:support-copy` | PASS, 177 production strings/files scanned | 0 |
| Locale JSON parsing | `node -e "JSON.parse(...en.json...); JSON.parse(...ar.json...)"` | PASS | 0 |

No existing assertion was modified or weakened. The complete 282-test backend suite was not run;
it remains reserved for T085.

---

## Phase 6 local log-redaction evidence

- **Timestamp**: 2026-08-02 (+03:00)
- **Branch / HEAD**: `018-security-remediation-hardening` /
  `d217c68f81c63b92ec883d109734c80c0de7bbb1`
- **Environment**: project virtual environment; synthetic test values only.

### Required pre-implementation red run

From `apps/api`:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_log_redaction.py -q
```

Authoritative result: `3 failed, 2 passed in 0.17s`, exit `1` (wall `1.96s`). The child logger's
message and formatting argument reached the root handler without redaction, and configuration with
no handler created none. The root-logger and already-redacted controls passed, establishing that the
capture harness and existing replacement semantics were working.

### Focused Phase 6 green run

The final command returned `6 passed in 0.12s`, exit `0` (wall `4.82s`). Each assertion captured the
actual formatted text written by a `logging.StreamHandler` backed by `StringIO`, not a `LogRecord` or
`caplog` record. It proves:

- `app.services.storage` child-log output redacts credential-shaped message text and masks email
  addresses after propagation;
- a credential supplied through `%s` formatting arguments is redacted without a formatting error,
  while its non-sensitive context remains readable;
- root-logger output remains redacted;
- already-redacted placeholders and masked addresses remain unchanged and readable;
- two `configure_logging()` calls create at most one fallback handler and attach exactly one
  `SensitiveDataFilter` to it;
- the existing auth database-error sanitizer still redacts connection URLs, password parameters,
  bearer credentials, and JWT-shaped values.

### Existing-site inspection and regressions

Inspection confirmed that `_sanitized_db_error` is still called before auth/database diagnostics are
logged; storage response bodies and transport exceptions still pass through `_redact_secret`; and
the Stripe, Apple, and Google webhook log statements contain only fixed context plus verified event
or notification identifiers. No request signature, authorization header, request body, provider
payload, storage response body, email, API key, or bearer credential was added to those log sites.
Webhook signature verification and business behavior were not changed.

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_storage_error_sanitization.py tests/test_support_purchases_webhooks.py -q
```

Result: `19 passed in 27.82s`, exit `0` (wall `30.65s`), with no skips. Python compilation of
`app/core/logging.py` and `tests/test_log_redaction.py` passed with exit `0`. No existing assertion
was modified or weakened. Ruff is not installed in the project virtual environment, so no Ruff run
was available. The complete backend suite was not run; it remains reserved for T085.

---

## Phase 7 local JWT algorithm-pinning evidence

- **Timestamp**: 2026-08-02 (+03:00)
- **Branch / HEAD**: `018-security-remediation-hardening` /
  `5be07357343add01fb74e8abe5e9096b75ec5ef8`
- **Environment**: project virtual environment and local Supabase Auth/JWKS only. Tests used local
  credentials and synthetic malformed tokens; no token, key, secret, or decoded identity was
  printed or recorded.

### Required pre-implementation red run

From `apps/api`:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_jwt_algorithm_pinning.py -q
```

Authoritative result: `2 failed, 9 passed in 9.36s`, exit `1` (wall `11.36s`). A synthetic HS256
token carrying the local JWKS key id caused HTTP `500` when the server was configured with only the
real local EC/ES256 JWKS. Direct diagnosis of the same production path produced the uncaught
`TypeError: Expected a string value` from PyJWT attempting HMAC key preparation with the asymmetric
public-key object. A controlled non-string `alg` declaration also produced HTTP `500`. In both
cases the protected route dependency was never entered, proving the failure was authentication
exception handling rather than a route or database fixture problem.

The `none`, unknown, and absent-algorithm cases already returned `401`; a legitimately issued local
user token was accepted; and the locally configured anon and service-role credentials were rejected
as user tokens. These controls established that local Auth, JWKS, the protected `/me` route, and the
test client were working.

### Focused Phase 7 green run

The final command returned `11 passed in 9.41s`, exit `0` (wall `12.03s`), with no skips. It proves:

- `none`, unknown, absent, non-string, structurally malformed, and key-mismatched algorithm paths
  all return the normal nondiagnostic `401/unauthenticated` response and never a `5xx`;
- an HS256 token with a matching EC JWKS key id is verified only under the trusted ES256 policy and
  is rejected cleanly;
- a legitimate local ES256 user token with a key id is resolved through the trusted JWKS and the
  `/me` response retains the correct user id and email;
- the actual local anon credential and service-role credential both verify under the configured
  legacy HS256 secret, are confirmed to lack `sub` and `email`, and remain rejected as application
  users with `401`;
- no malformed request reaches the protected operation dependency, and no response exposes PyJWT,
  `TypeError`, traceback, or key-handling detail.

### Existing authentication regressions

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_users_locale.py tests/test_signup_bootstrap.py tests/test_rate_limits.py::test_unauthenticated_request_is_401_not_429 tests/test_log_redaction.py -q
```

Result: `12 passed in 4.38s`, exit `0` (wall `6.30s`), with no skips. This preserves authenticated
`/me` access, unauthenticated `401` behavior and rate-limit ordering, workspace bootstrap/repair,
and auth-error redaction. Python compilation of `app/core/auth.py` and
`tests/test_jwt_algorithm_pinning.py` passed with exit `0`. Ruff is not installed in the virtual
environment, so no Ruff run was available. No existing assertion was modified or weakened. The
complete backend suite was not run; it remains reserved for T085.

---

## Phase 8 local production-surface evidence

- **Timestamp**: 2026-08-02 12:35:44 +03:00
- **Branch / HEAD**: `018-security-remediation-hardening` /
  `d376cd9817143ee2d01486560e4fe60f01e0fe9e`
- **Environment**: fresh in-process FastAPI applications created after each controlled environment
  change; local ASGI transport only. No hosted service or outbound provider was contacted.

### Required pre-implementation red run

From `apps/api`:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_production_surface.py -q
```

Authoritative result: `7 failed, 5 passed in 3.01s`, exit `1` (wall `5.6s`). Actual HTTP
requests showed `/docs`, `/redoc`, and `/openapi.json` returning `200` under production, unset,
and unrecognized `APP_ENV`; the pytest marker caused diagnostic disclosure even when `APP_ENV`
was explicitly production; the old `/health` invoked the patched `urlopen`, read the guarded
service-role environment key, and was a synchronous handler. The dev diagnostic/docs controls and
production-like diagnostic controls with the pytest marker removed passed, demonstrating that the
app construction and response-capture harness was valid.

### Focused Phase 8 green run

The final focused command returned `15 passed in 2.47s`, exit `0` (wall `5.4s`), with no skips.
Each environment case constructs a fresh app after setting `APP_ENV`, clears the settings cache,
and restores the imported module and process environment afterward. Actual HTTP results prove:

- production, unset, empty, and unrecognized `APP_ENV` return `404` from all three documentation
  routes; `dev` and a normalized mixed-case `development` value return normal `200` HTML/JSON;
- production, unset, empty, and unrecognized values omit `diagnostic` at every response nesting
  level while preserving `503/workspace_bootstrap_unavailable`; explicit `dev` retains the existing
  diagnostic control;
- `PYTEST_CURRENT_TEST` retains compatibility only when `APP_ENV` is absent and cannot override an
  explicit production value;
- `/health` returns exactly `{"status":"ok"}` when both the legacy bound `urlopen` and the urllib
  primitive are patched to fail, with neither patched function called;
- a guarded environment accessor proves `/health` never reads `SUPABASE_SERVICE_ROLE_KEY`;
- the route is an async coroutine, never invokes the patched legacy database helper, and completes
  promptly with an unroutable `SUPABASE_URL`, without worker-thread offloading or a connectivity
  claim.

### T073 existing-test review and regressions

The Phase 2 T008 follow-up was rechecked across `apps/api/tests/`, `apps/web/tests/`,
`apps/web/e2e/`, `apps/web/components/**/__tests__/`, and `apps/web/lib/**/__tests__/`. No
pre-existing test asserted `/health`'s former `dependencies.database` shape or assumed that docs or
OpenAPI were always enabled, so no existing test file required an expectation change. The new
production-surface suite owns the revised process-liveness and environment-controlled docs
contracts explicitly.

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_jwt_algorithm_pinning.py tests/test_signup_bootstrap.py tests/test_users_locale.py tests/test_log_redaction.py -q
```

Result: `22 passed in 15.78s`, exit `0` (wall `19.2s`), with no skips. This preserves JWT and
authenticated-route behavior, workspace bootstrap, normal `401` behavior, and diagnostic/log
redaction while exercising startup imports. Python compilation of all four changed production
modules and the new test module passed with exit `0`; Ruff is not installed in the project virtual
environment, so no Ruff run was available. No existing assertion was modified or weakened. The
complete backend suite was not run; it remains reserved for T085.

---

## Phase 9 local RLS-helper relocation evidence

- **Timestamp**: 2026-08-02 13:57:30 +03:00
- **Branch / HEAD**: `018-security-remediation-hardening` /
  `d463bb81cc56b44a08bab7acb67c0d310dea60ff`
- **Disposable environment**: isolated Supabase-compatible PostgreSQL 15 stack with project id
  `phase18-p9-disposable`, API on `127.0.0.1:55321`, and PostgreSQL on
  `127.0.0.1:55322`. Test settings were read from local CLI status into process environment only;
  no key, token, password, or connection secret was recorded. It was separate from the normal
  `smart-expense-ai` stack.

### T075 independently re-derived inventory

The source search covered every migration, `apps/api/app`, tests, and Phase 18 documentation. Live
catalog inspection covered `pg_proc`, `pg_policy`, and `pg_depend`, plus every active function and
trigger body. Results:

- historical migration source has 40 `workspace_role_for` policy-call occurrences and 7
  `is_workspace_member` occurrences;
- the live database has 36 active `workspace_role_for` calls across 21 policies and 7 active
  `is_workspace_member` calls across 7 policies: 43 active calls across 28 policies;
- the four-call difference is the policy dropped by `20260703000000...`; its two-call replacement
  is already part of the historical-source count;
- five active textual body references exist, exactly in `is_workspace_member`,
  `set_workspace_ai_key`, `clear_workspace_ai_key`,
  `get_workspace_ai_key_for_extraction`, and `confirm_ai_extraction`;
- no trigger body and no backend production SQL string calls either helper directly;
- the single unqualified historical policy call remains confirmed at
  `20260722000000_hierarchical_categories.sql:239`;
- policy dependencies are OID-bound (29 dependency rows for `workspace_role_for`, 7 for
  `is_workspace_member`); the five bodies are textual/name-bound.

The corrected runtime-sensitive total is therefore 48 (43 policy calls plus five live bodies), not
the earlier rough `~55`. `data-model.md` records the explained historical-versus-active distinction.

### Required red evidence

From `apps/api`, before the migration, the exact command was:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_private_schema_exposure.py -q
```

Authoritative normal-local result: `4 failed, 3 passed in 39.65s`, exit `1` (wall `43.2s`). The
same corrected harness against the disposable Phase 8 baseline returned `4 failed, 3 passed in
11.61s`, exit `1` (wall `19.2s`). Failures proved that both helper signatures were still in
`public`, `workspace_role_for` returned HTTP `200` through real PostgREST, live policy dependencies
still resolved to `public`, and the two residual functions still inherited PUBLIC/anon execution.
The Phase 3 RPC control and other existing exposure controls passed. An initial disposable attempt
used the CLI's synchronous PostgreSQL URL with the async SQLAlchemy engine and was discarded as a
harness error; replacing only its scheme with `postgresql+asyncpg` produced the authoritative red
result above.

### Disposable migration, idempotence, and catalog result

Migrations through `20260731000000` were applied when the disposable stack started. Phase 9 was
then applied with:

```powershell
npx --no-install supabase migration up --local --workdir D:\claude\phase18-p9-disposable
docker exec supabase_db_phase18-p9-disposable psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -f /tmp/20260732000000_private_schema_rls_helpers.sql
```

The first command applied the new migration; the second executed the complete SQL again and passed
all built-in assertions, proving idempotence. Migration history contained exactly one normal
`20260732000000` row. Helper OIDs remained `17520` and `17521`; owner, security-definer mode,
stable volatility, non-strictness, parallel mode, and `search_path=public` were unchanged. All 36
policy dependency rows followed those OIDs into `private`.

The five source bodies were compared before application after reversing only
`private.workspace_role_for` to the old qualifier; all five reported `BODY_MATCH`. Post-application
catalog output showed each body containing `private.workspace_role_for` and no stale
`public.workspace_role_for`.

Final ACLs in the disposable and normal catalogs were identical:

| Function | Schema | `authenticated` | `anon` | PUBLIC |
|---|---|---:|---:|---:|
| `workspace_role_for(uuid,uuid)` | `private` only | EXECUTE | none | none |
| `is_workspace_member(uuid,uuid)` | `private` only | EXECUTE | none | none |
| `receipt_object_workspace_id(text)` | `public` only | EXECUTE | none | none |
| `validate_category_assignment(uuid,uuid,text)` | `public` only | EXECUTE | none | none |

### Disposable focused and regression gates

All commands ran from `apps/api` with the project virtual environment and disposable local settings:

| Gate / exact pytest arguments | Result | Duration | Exit |
|---|---:|---:|---:|
| `tests/test_private_schema_exposure.py -q` | 8 passed | 19.24s | 0 |
| RG-1: `tests/acceptance/test_acc_tenant_isolation.py -q` | 4 passed | 17.20s | 0 |
| RG-2: `tests/acceptance/test_acc_role_permissions.py -q` | 2 passed | 15.36s | 0 |
| RG-9: six `tests/test_ai_settings_*.py` mapped files | 7 passed | 17.71s | 0 |
| RG-10: `tests/test_extraction_confirm_workspace_currency.py tests/test_extraction_confirm.py -q` | 6 passed | 13.75s | 0 |
| Role/workspace supplement | 3 passed | 13.60s | 0 |
| Extraction trigger/isolation/category/authorization supplement | 16 passed | 38.68s | 0 |
| Category tree/manage/assignment supplement | 27 passed | 35.14s | 0 |
| Receipt/file/storage supplement | 15 passed | 35.65s | 0 |

The focused suite includes direct ordinary-user PostgREST calls proving both RPC names return `404`,
catalog assertions proving private-only placement and ACLs, owner/member/outsider workspace RLS
visibility, and a direct Storage API test proving an authenticated member can upload/read/delete a
receipt object while an outsider cannot read it. The category suites exercise valid assignment,
cross-workspace rejection, and the unchanged validation trigger. No test was skipped, weakened, or
xfail-marked.

### Normal local application and verification

Only after every disposable gate passed, the migration was applied non-destructively to the normal
local development database:

```powershell
npx --no-install supabase migration up --local
```

The normal helper OIDs remained `17896` and `17897`; all metadata and the 29/7 policy-dependency-row
counts matched the disposable result. Migration history contains exactly one `20260732000000` row.
The normal verification commands/results were:

| Gate / exact pytest arguments | Result | Duration | Exit |
|---|---:|---:|---:|
| `tests/test_private_schema_exposure.py -q` | 8 passed | 79.24s | 0 |
| RG-1: `tests/acceptance/test_acc_tenant_isolation.py -q` | 4 passed | 161.11s | 0 |
| RG-2: `tests/acceptance/test_acc_role_permissions.py -q` | 2 passed | 130.70s | 0 |
| RG-9: six mapped AI-settings files | 7 passed | 47.51s | 0 |
| RG-10: two mapped extraction-confirm files | 6 passed | 35.39s | 0 |
| Category tree/manage/assignment files | 27 passed | 60.94s | 0 |
| Receipt/file/storage files | 15 passed | 113.10s | 0 |

These results preserve Owner/Admin/Member/Viewer/non-member decisions, tenant isolation, BYOK
configure/replace/remove and Vault retrieval, extraction confirmation and cross-workspace denial,
category-trigger behavior, and receipt/storage isolation. The disposable stack was then stopped
with `--no-backup`; verification found zero matching containers and zero matching volumes. The
normal local database remains in the expected Phase 9 state for later phases.

---

## Phase 10 CI supply-chain evidence

- **Timestamp**: 2026-08-02 15:13:33 +03:00
- **Branch / HEAD**: `018-security-remediation-hardening` /
  `c7d2641c35cae5730d055acb94a2e2ba6d44bf7b`

### External-action inventory and verified pins

All ten `uses:` lines in `.github/workflows/ci.yml` were external repository actions. There were no
local (`./...`) or Docker action references. The pinned Playwright image is invoked by a normal
`docker run` command and is therefore not a `uses:` action reference.

| Official upstream repository | Occurrences | Previous reference | Verified release | Full commit SHA |
|---|---:|---|---|---|
| `https://github.com/actions/checkout` | 2 | `actions/checkout@v4` | `v4.4.0` | `11d5960a326750d5838078e36cf38b85af677262` |
| `https://github.com/actions/setup-python` | 2 | `actions/setup-python@v5` | `v5.6.0` | `a26af69be951a213d495a4c3e4e4022e16d87065` |
| `https://github.com/actions/setup-node` | 2 | `actions/setup-node@v4` | `v4.4.0` | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
| `https://github.com/supabase/setup-cli` | 2 | `supabase/setup-cli@v1` | `v1.7.1` | `ab058987d8d6c725971f6cf9d0b5c98467e30bd1` |
| `https://github.com/actions/upload-artifact` | 2 | `actions/upload-artifact@v4` | `v4.6.2` | `ea165f8d65b6e75b540449e92b4886f43607fa02` |

Each release was resolved directly from its official upstream with
`git ls-remote --tags <official-repository> refs/tags/<version> refs/tags/<version>^{}`. The
dereferenced commit was preferred for annotated tags; otherwise the lightweight tag target was
used. A second exact-tag resolution verified every recorded value, and all values passed the full
40-character hexadecimal check. Duplicate occurrences use the same verified SHA and carry the
exact release comment.

### Static and YAML validation

An isolated Python 3.12 environment with `PyYAML==6.0.2` parsed both changed YAML files. Source-level
assertions returned exit `0` and proved:

- all 10 external action references use a full 40-character SHA and an exact version comment;
- no mutable `main`, `master`, or major-tag action reference remains;
- duplicate references use consistent SHAs;
- both audit commands are present, both complete steps have `continue-on-error: true`, and no
  `audit fix` command exists;
- Dependabot has exactly `pip` at `/apps/api`, `npm` at `/`, and `github-actions` at `/`, all on
  weekly schedules and with no additional keys.

`actionlint` was not installed locally, so it was not run. YAML parsing, the dedicated source-level
checks, and `git diff --check` provide the available local static validation; no GitHub-hosted CI
execution is claimed.

### Non-blocking dependency-audit execution

The Python audit tool version was selected from the official PyPI JSON metadata. `pip-audit 2.10.1`
was a current, non-yanked stable release requiring Python 3.10 or newer. It was installed only in an
isolated temporary environment, which was removed after validation.

```powershell
python -m pip install pip-audit==2.10.1
pip-audit -r apps/api/requirements.txt
npm audit --audit-level=high
```

- `pip-audit` completed in 57.07 seconds with exit `1` and reported 13 known vulnerability records
  across two packages (`pyjwt` and `pytest`). The tool did not report severity counts in its table.
- `npm audit` completed in 7.52 seconds with exit `1` and reported 13 vulnerabilities: 1 low,
  2 moderate, 9 high, and 1 critical.
- Both nonzero exits represent vulnerability findings, not invalid commands or paths. The CI steps
  intentionally use `continue-on-error: true`, so these findings are informational in Phase 10.
  No vulnerability is claimed remediated.
- Git blob hashes and an explicit diff check confirmed that `apps/api/requirements.txt`,
  `package.json`, and `package-lock.json` were unchanged after both audits. No fix, upgrade, or
  dependency rewrite command ran.

### Dependabot result

`.github/dependabot.yml` uses version 2 syntax and contains exactly three weekly update entries:
Python/pip at `/apps/api`, npm at the repository root, and GitHub Actions at the repository root.
It contains no registries, credentials, automatic-merge configuration, or dependency groups.
Configuration validity is proven locally; no Dependabot run or generated pull request is claimed.

---

## Not tested here, by design

| Item | Why | Where it is covered |
|---|---|---|
| Hosted exposed-schemas setting | Not observable from a local test — dashboard config outside version control | Release gate with recorded evidence (spec FR-038, SC-018); quickstart step |
| Live Stripe/Apple/Google sandbox purchases | Out of scope (spec Out of Scope); Phase 17 T052 stays open | Not covered — must not be claimed |
| Hosted/production Phase 9 state | Local-only implementation; no hosted database was contacted | Deployment/release verification only |
