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

---

## Phase 11 local release-verification evidence

- **Date / branch / HEAD**: 2026-08-02 / `018-security-remediation-hardening` /
  `f2b82351dfe5b2b5375771138f67a4c18c730487`
- Phase 10 was committed, the index was empty, and the only initial untracked path was the
  pre-existing `qa-reports/` directory. It was not read or modified.
- Tooling: Python 3.12.6, Node 24.12.0, npm 11.6.2, Supabase CLI 2.111.0,
  Playwright 1.61.1, and Docker client/server 29.5.3.

### T085 backend gate and baseline comparison

From `apps/api`, with the project virtual environment active:

```powershell
python -m pytest tests/ -q
```

Result: **346 passed in 1102.82s (18:22), exit 0**; zero failed, skipped, xfailed,
xpassed, collection errors, or runtime errors.

The recorded baseline was 282 passed in 1180.36s at commit
`0754c9041781955a981c99eede881202a2dac12d`. A temporary `git archive` of that exact commit was
collected with `pytest --collect-only -q` without changing branches. The baseline yielded 282 node
IDs and the current tree yielded 346. Set comparison found **zero missing baseline tests** and
**64 new Phase 18 tests**. The archive was removed after comparison. No baseline test was renamed,
deleted, newly skipped, or newly xfailed.

Test-file inventory relative to the baseline:

- Existing files changed: `apps/api/tests/conftest.py` changed only the trusted SQL call from
  `public.ensure_personal_workspace` to `private.ensure_personal_workspace`;
  `apps/api/tests/test_extraction_secrecy.py` changed the catalog namespace scanned by
  `test_only_key_read_rpc_function_ever_queries_vault_decrypted_secrets` from `public` to `private`.

  **Correction (Correction Pass A).** The original wording here — "changed only the expected catalog
  namespace" and "no pre-existing assertion was weakened" — was accurate about the assertion
  expression but misleading about coverage, and is superseded. The `assert` itself was untouched, but
  swapping the scanned schema **narrowed** the check: it stopped covering `public`, which is the
  schema PostgREST publishes and therefore the higher-risk namespace. A new `public` function reading
  `vault.decrypted_secrets` would no longer have been detected. That was a real Phase 18-introduced
  security-coverage regression. It is fixed — see "Phase 11 Correction Pass A" below.
- New backend files: `test_identity_guard.py`, `test_jwt_algorithm_pinning.py`,
  `test_log_redaction.py`, `test_migration_safety.py`, `test_private_schema_exposure.py`,
  `test_production_surface.py`, and `test_rate_limits.py`.
- New web file: `apps/web/tests/unit/rate-limit-messages.test.ts`. T073 required no modification to
  an existing test; the production-surface expectations live in the new Group PS file.
- No test file was deleted or renamed.

### T086 frontend gate

```powershell
npm run test --workspace=@smart-expense/web
cd apps/web
npx playwright test e2e --workers=1
```

- Web unit tests: **46 files, 237 tests passed in 56.43s, exit 0**. English and Arabic locale
  loading and the new `errors.rateLimited` parity assertion passed.
- Playwright: **102 passed, 22 skipped, 11 failed in 16.9 minutes, exit 1** (135 total). It ran
  against current isolated web/API processes on ports 3100/8001 because stale local processes had
  occupied the defaults; the current API returned the Phase 18 process-only health shape.
- Failures were recorded without changing tests: two July-2026 date expectations ran against an
  August-2026 current period; two support-return tests use a hard-coded `localhost:3000` while the
  isolated run was on 3100; four visual snapshots differed by about 4% from their Linux reference;
  one history test returned Internal Server Error; and two `mobile-navigation` T062 tests timed out
  waiting for the category-breakdown control. Consequently T086 remains unchecked.

  **Correction (Correction Pass A).** The two T062 failures were originally described in a way that
  implied a mobile touch-target defect. That classification is not supported by the evidence and is
  withdrawn. `qa-reports/2026-08-01/automated-qa-report.md` diagnoses them as the same stale
  current-period fixture problem as the F-001 date failures (`TEST-GAP-02`): the spec seeds an
  expense dated `2026-07-01`, the current-period category-breakdown control therefore never renders,
  and the locator times out. Both also fail at the canonical base URL `:3000`, so they are neither
  environment-induced nor Phase 18-induced. The 44x44 touch-target property itself was **not
  evaluated** by these runs — that remains an open coverage gap, not a proven failure. Playwright
  triage as a whole is out of scope for Correction Pass A and T086 stays unchecked.

### T087 MG-1: disposable SQL idempotence

A disposable Supabase stack (`phase18-p11-mg1`, isolated ports 56321-56326) applied the 12-project
migration baseline immediately before `20260731000000`, then applied the target once through
`supabase migration up --local`. The complete SQL file was then sent directly to that disposable
PostgreSQL container a second time with `psql -X -v ON_ERROR_STOP=1`.

First- and second-run canonical catalog snapshots were identical (`Compare-Object` difference
count 0): four private-only functions, stable OIDs, owners, security modes, search paths and ACLs;
45 tables, 33 policies and 34 non-internal triggers; the policy expression followed
`private.shares_workspace_with`; `handle_new_user` and its trigger survived; and the
`identity_mismatch` guard remained present. Migration history contained exactly one
`20260731000000` row. Direct SQL re-execution does not insert migration-history rows; the normal
migration runner inserted the single row on first application. The stack was stopped with
`--no-backup`, and its containers, volumes, and work directory were removed.

### T088 MG-2: whole-file rollback blocker

> **Superseded by Correction Pass A.** The whole-file composition described in this subsection was
> never a valid rollback procedure, and nothing below should be read as endorsing it. `rollback.sql`
> no longer has a whole-file mode. See "Phase 11 Correction Pass A" for the corrected interface and
> the re-proven T088 result.

A fresh disposable full-migration stack (`phase18-p11-mg2`) executed the complete reviewed
`rollback.sql` without a SQL-level error — that is, psql exited 0. Exit 0 was itself part of the
defect: the run reported success while leaving an invalid state. Tables, policies, and triggers
stayed at 45/33/34, the RLS policy followed the returned public `shares_workspace_with`, and
ordinary-user PostgREST calls proved all four public rollback targets were reachable
(HTTP 204/200/200/200, never 404).

The resulting state did **not** satisfy the application gate. Section A moved the guarded
`ensure_personal_workspace` to `public`, after which Section B independently created an unguarded
copy in `private`, leaving five target rows rather than four. More importantly, the current app
still qualifies `private.find_user_profile_by_email` and
`private.get_workspace_ai_key_for_extraction`, which Section A removes.

```powershell
python -m pytest tests/test_signup_bootstrap.py tests/test_extraction_secrecy.py `
  tests/test_workspace_members_list.py -q
```

Result after whole-file rollback: **1 passed, 4 failed in 14.03s, exit 1**. The failures were the
expected missing-private-function errors, not weakened assertions. T088 remains unchecked. The
disposable stack was destroyed; the rollback was never applied to the normal local database.

### T089 MG-3: independent rollback sections

Section boundaries were extracted reproducibly after normalizing CRLF to LF: Scenario A used the
substring before the separator immediately preceding `-- Section B:`; Scenario B used that marker
through EOF. Each substring contained its own single `BEGIN`/`COMMIT` and neither contained the
other section.

- Scenario A, on a fresh full stack: SQL exit 0; exactly four public targets with original OIDs and
  grants; the Phase 4 guard remained on public `ensure_personal_workspace`; private Phase 9 helpers
  and all 45/33/34 object counts remained intact. A baseline-compatible application archive ran
  signup, extraction secrecy, member-list, and AI-settings tests: **6 passed in 11.55s, exit 0**.
- Scenario B, on a separately recreated fresh full stack: SQL exit 0; only the identity guard was
  removed, `ensure_personal_workspace` kept its OID, all four Phase 3 functions stayed private,
  grants and trigger wiring were unchanged, and object counts stayed 45/33/34. The current app ran
  the same focused files: **6 passed in 12.69s, exit 0**.

Both disposable states, containers, volumes, and temporary application archive were removed.

### T090 MG-4 / MG-5 static gates

- Case-insensitive literal count of `create policy|drop policy|create table|alter table` in
  `20260731000000_private_schema_privileged_functions.sql`: **0**.
- Statement-aware count after stripping SQL comments: **0**.
- Recursive production-code search under `apps/api/app` for the four old `public.`-qualified target
  calls: **no matches** (`rg` exit 1, the expected no-match status).

### T091 Quickstart Steps 1-9

The mapped backend command below passed **68 tests in 144.35s, exit 0**:

```powershell
python -m pytest tests/test_private_schema_exposure.py tests/test_identity_guard.py `
  tests/test_extraction_secrecy.py tests/test_signup_bootstrap.py `
  tests/test_workspace_members_list.py tests/test_workspace_members_add.py `
  tests/test_extraction_trigger.py tests/test_extraction_authorization.py `
  tests/test_ai_summary.py tests/test_ai_summary_error_handling.py `
  tests/test_files_access_privacy.py tests/test_rate_limits.py `
  tests/test_production_surface.py tests/test_log_redaction.py -q
```

| Step | Command or UI action | Expected | Actual | Status / evidence |
|---|---|---|---|---|
| 1 | Real ordinary-user PostgREST Group EX tests | Four private RPCs 404; EX-5 control not 404 | Four 404s; `clear_workspace_ai_key` control resolved and was not 404 | PASS, `test_private_schema_exposure.py` |
| 2 | Direct DB identity-guard tests plus PostgREST exposure | Cross-user mutation refused and victim unchanged | SQLSTATE 42501 `identity_mismatch`; target unchanged; matching/NULL paths passed | PASS, `test_identity_guard.py` |
| 3 | Member/BYOK secrecy tests | RPC 404 and no raw key in client/log output | 404; synthetic key absent from responses and logs | PASS, exposure and extraction-secrecy files |
| 4a | Real Chromium signup through `/en/sign-up` on current local web/API | Dashboard reached; personal workspace; Owner | Targeted auth flow 2/2 passed in 1.1m; DB follow-up found 1 new UI user, 1 personal workspace, 1 Owner membership | PASS; T035 completed |
| 4b | Real Chromium sign-in/dashboard/sign-out control | Existing ordinary account reaches dashboard without bootstrap 503 | Passed in the same targeted auth run | PASS |
| 4c-4d | Owner invite existing/nonexistent email tests | Correct member added; unknown address 404 | Unchanged role matrix and errors passed | PASS, `test_workspace_members_add.py` |
| 4e-4g | Mocked/local extraction, summary, and Viewer controls | Legitimate roles succeed; Viewer refused; no live provider | Happy path/summary passed with mocks; Viewer denial passed | PASS, extraction/summary suites |
| 4h | Real ordinary owner/member/outsider RLS member-list test | Co-member visible; unrelated user filtered | Member saw owner/member; outsider received 404; policy dependency resolves private `shares_workspace_with` | PASS, `test_workspace_members_list.py` plus exposure catalog test |
| 4i | Receipt download-access tests | Member gets short-lived URL; outsider/anonymous denied | URL expiry and denial assertions passed | PASS, `test_files_access_privacy.py` |
| 5 | Rate-limit/webhook backend tests and complete web units | Ordering, 429 envelope, unthrottled webhooks, EN/AR parity | Backend rate-limit suite passed inside 68; web 237/237 passed | PASS |
| 6 | Group PS plus actual production/unset/dev HTTP runs | Prod/unset docs 404; dev 200; liveness has no dependency probe | Prod 404/404/404, unset 404/404/404, dev 200/200/200; zero-network/credential/thread tests passed | PASS |
| 7 | Direct synthetic child-logger probe | Bearer and email redacted | `Bearer [REDACTED]` and `u***@example.com` emitted | PASS |
| 8 | Disposable idempotence, rollback, independent sections, static gates | All migration and rollback gates pass | MG-1, MG-3, MG-4/5 passed; whole-file MG-2 app gate failed as recorded above. **Re-run green in Correction Pass A** against the corrected explicit-target interface — see below | **PASS (after Correction Pass A)** |
| 9 | Full backend, web unit, and Playwright commands | All pass unchanged | Backend 346/346 and web unit 237/237 passed; Playwright 11 failures | **FAIL / BLOCKED** |

Because Steps 8 and 9 are not fully green, T091 remains unchecked even though Steps 1-7 pass.
(Correction Pass A subsequently turned Step 8 green; Step 9 is still blocked on the Playwright gate,
so T091 stays unchecked.)

### Hosted gates and non-goals

- **T092 — superseded: now PASSED.** At the time of this section no authorized hosted-project
  settings evidence had been supplied, and the local `schemas = ["public"]` setting was never
  substituted for it. The Dashboard evidence was subsequently captured and verified — see "T092
  hosted exposed-schema evidence" at the end of this document.
- **T093 — superseded: now PASSED.** At the time of this section no `DEPLOYED_URL` or deployed
  ordinary-user credentials had been supplied, and no local or mocked request was substituted. The
  gate was subsequently executed against the real hosted project — see "T093 deployed PostgREST
  smoke" at the end of this document.
- Phase 17 T052 remains unchecked. `apps/api/app/core/support_tiers.py` has the same Git blob
  (`82391707b740745de9cc15aa7e4a771714b7df59`) as the Phase 17 baseline; no Phase 18 commit changed
  its placeholder price IDs. No Stripe, Apple, or Google sandbox was contacted, and no Phase 18
  artifact claims live provider purchase completion.

The normal local database retained 14 migration-history rows with exactly one
`20260731000000` row and one `20260732000000` row, 33 policies, and 34 non-internal triggers. No
rollback or disposable migration command targeted it. Local tests and the real browser signup did
create uniquely named local test fixtures; no baseline/project record was deleted and no protection
trigger was bypassed.

---

## Phase 11 Correction Pass A

- **Date / branch / HEAD**: 2026-08-02 / `018-security-remediation-hardening` /
  `f2b82351dfe5b2b5375771138f67a4c18c730487` (unchanged; nothing was staged, committed, or pushed).
- **Scope**: the rollback-contract defects and the baseline security-test coverage regression only.
  Playwright triage (T086) and dependency-vulnerability remediation were not started. T092 and T093
  were not touched.
- **Disposable environment**: an isolated Supabase stack, project `phase18-p11-pa`, ports
  56321-56324, created in a scratch working directory outside the repository with a copy of the
  project's 14 migrations. The normal local stack (`smart-expense-ai`, ports 54321-54324) was never
  a rollback target.

### Defect reproduction (test-first)

Reproduced against the disposable stack with the **pre-correction** `rollback.sql`, from a clean
`supabase db reset` state (all four routines in `private`):

| # | Reproduction | Observed |
|---|---|---|
| D-1 | Whole-file execution (`psql -f rollback.sql`) | **exit 0** — reported success — leaving five target rows: guarded `public.ensure_personal_workspace` **and** unguarded `private.ensure_personal_workspace` |
| D-2 | Section B alone with the routine absent from `private` | **exit 0**; `create or replace` **created** an unguarded `private.ensure_personal_workspace` instead of replacing one |
| D-3 | Section A re-run against the resulting public+private duplicate | **exit 0**; the `elsif` no-opped and the duplicate survived — the ambiguous state was tolerated, not raised |

D-1 is the composition of D-2 with Section A's relocation. Exit 0 in all three cases is the core
hazard: an operator had no signal that the rollback had produced an invalid state.

### Corrected interface

`rollback.sql` now takes a required psql variable and executes exactly one target per invocation:

```bash
psql <db> -v rollback_target=phase3         -f rollback.sql
psql <db> -v rollback_target=identity_guard -f rollback.sql
```

The branch decision is made by a single `\gset` outside any dollar-quoted body (psql does not
interpolate variables inside `$$ ... $$`), and each target lives in its own `\if` block with its own
`begin`/`commit`. psql skips the untaken branch entirely, so **the two targets cannot be composed in
one run** — D-1 is structurally impossible rather than merely discouraged.

Both targets end with an in-transaction verification block that raises on any deviation from the
documented end state, so a partial or unexpected result aborts instead of committing.

### Target `phase3` — proven end state

Fresh disposable database, all migrations applied, then `-v rollback_target=phase3`; **exit 0**.

| Property | Expected | Actual |
|---|---|---|
| Relocation | 4 routines in `public`, exactly once each | `public.ensure_personal_workspace`, `public.find_user_profile_by_email`, `public.get_workspace_ai_key_for_extraction`, `public.shares_workspace_with` |
| No duplicates | 0 `private` copies of the four | `private_dups=0` |
| Grants | `authenticated` EXECUTE; `anon` and `PUBLIC` denied | `auth=t, anon=f, PUBLIC=f` on all four |
| Phase 4 guard | Retained | `guard_retained=true` |
| `handle_new_user` | Calls `public.ensure_personal_workspace`, `search_path = public` | both confirmed; no `private.` reference remains |
| Trigger | `on_auth_user_created` survives | 1 row |
| RLS policy | Follows the returned public routine | `shares_workspace_with(id, auth.uid())` |
| Phase 9 | Not reversed | `private.workspace_role_for`, `private.is_workspace_member` still private |

Re-running `phase3` against the already-reversed database is a no-op (exit 0, still 4 public / 0
private).

**Application compatibility — recorded honestly.** Against this exact database state:

- A **compatible public-calling application revision** (`git archive e0c608f`, the pre-Phase-3 tree,
  extracted outside the repository) ran
  `test_signup_bootstrap.py test_extraction_secrecy.py test_workspace_members_list.py
  test_workspace_members_add.py test_ai_settings_secrecy.py` → **7 passed in 18.04s, exit 0**.
- The **current** private-qualified tree ran the same five files → **6 failed, 1 passed in 16.66s**,
  with `asyncpg.exceptions.UndefinedFunctionError: function private.ensure_personal_workspace(...)
  does not exist`.

The `phase3` target therefore **requires a coordinated application rollback**. No claim is made that
the current tree remains compatible with it. (The single passing test in the second run is the
corrected `vault.decrypted_secrets` catalog scan, which is placement-agnostic by design.)

### Target `identity_guard` — proven end state

Fresh disposable database, then `-v rollback_target=identity_guard`; **exit 0**.

| Property | Expected | Actual |
|---|---|---|
| Placement | All four Phase 3 routines stay `private` | confirmed; Phase 9 helpers also still `private` |
| Guard | Removed from `private.ensure_personal_workspace` only | `guard_pos=0` |
| OID | Preserved across `create or replace` | `17781` then `17781` |
| Public duplicate | None created | `no_public_dup=t` |
| Metadata | `SECURITY DEFINER`, `search_path=public` | `prosecdef=t`, `{search_path=public}` |
| Grants | `authenticated` EXECUTE; `anon`/`PUBLIC` denied | confirmed |
| `handle_new_user` | Still calls the private routine | confirmed |
| Trigger | `on_auth_user_created` survives | 1 row |

**No application rollback is required.** The **current** application tree ran the same five focused
files against this state → **7 passed in 16.61s, exit 0**.

### Invalid invocations — all fail closed

Each exited non-zero with the database unchanged:

| Scenario | Result |
|---|---|
| No `rollback_target` | exit 3; `missing or unknown rollback target: '<unset>'`; no change |
| `rollback_target=everything` | exit 3; same error naming the received value; no change |
| Empty `rollback_target` | exit 3; no change |
| `identity_guard` when the routine is not in `private` | exit 3; `must not create the routine`; **0 private copies created**, guard left untouched on the public copy |
| `phase3` against a public+private duplicate | exit 3; `ambiguous state ... Refusing to proceed`; duplicate left intact for manual resolution |
| `phase3` against a database missing the routine entirely | exit 3; `exists in neither public nor private` (observed incidentally when a `supabase db reset` failed to bootstrap) |

The fourth and fifth rows are the direct fixes for D-2 and D-3.

### Why T089 passed while the old whole-file T088 failed

Not a contradiction, and the corrected artifact makes the reason explicit. T089 tested **each section
against the application state that section targets** — Section A against a public-calling revision,
Section B against the current private-calling tree — so both were coherent and both passed. The old
T088 composed **both sections against a single application state that neither target matches**:
Section A relocated the routines to `public` (breaking the current private-qualified tree) and
Section B then created a second, unguarded copy in `private` (an end state no target ever specified).
The Correction Pass A pairing above reproduces this precisely: the same `phase3` database yields
7 passed with a compatible revision and 6 failed with the current one.

### Security-test coverage restoration

`apps/api/tests/test_extraction_secrecy.py::test_only_key_read_rpc_function_ever_queries_vault_decrypted_secrets`
now scans `where n.nspname in ('public', 'private')`. The assertion is unchanged
(`names == {"get_workspace_ai_key_for_extraction"}`), so this widens coverage and weakens nothing.

Proven in both directions on the disposable stack:

| Injected offender | Result |
|---|---|
| `public.leaky_probe()` reading `vault.decrypted_secrets` | **FAILS** — `assert {..., 'leaky_probe'} == {'get_workspace_ai_key_for_extraction'}` |
| `private.leaky_probe()` reading `vault.decrypted_secrets` | **FAILS** — same assertion |
| Neither present | **PASSES** |

Under the previous `private`-only scan the public offender would not have been detected. Both probes
were dropped immediately afterwards; neither was created on the normal local database.

The normal local database was independently checked for pre-existing offenders before the full
rerun — the `public`+`private` scan returned only `private.get_workspace_ai_key_for_extraction`, so
the broadened test reflects real posture there rather than local drift.

### Quickstart Step 8 re-run

Executed on a fresh disposable database against the corrected procedure:

- **Idempotence**: `20260731000000` applied a second and third time, exit 0 both times; canonical
  catalog snapshots after the 2nd and 3rd applications were byte-identical (`diff` clean); migration
  history still held exactly one `20260731000000` row.
- **Rollback**: both targets proven from fresh state as tabulated above.
- **Static gates**: `grep -icE 'create policy|drop policy|create table|alter table'` on the
  migration returned **0**; `public.`-qualified target calls under `apps/api/app` returned **0**.

Step 8 is now **PASS**. Step 9 remains blocked on the Playwright gate, so T091 stays unchecked.

### T085 re-run after the test change

A pre-existing security test changed in this pass, so the complete backend gate was re-run against
the normal local stack:

```powershell
cd apps/api
python -m pytest tests/ -q
```

Result: **346 passed in 1204.25s (0:20:04)** — zero failed, skipped, xfailed, xpassed, collection
errors, or runtime errors. The count is unchanged from the pre-correction run (346), confirming the
`test_extraction_secrecy.py` edit widened a query without adding, removing, or disabling any test.
Baseline preservation is unaffected: the diff against `0754c9041781955a981c99eede881202a2dac12d`
still shows zero deleted or renamed tests and the same 64 Phase 18 additions. T085 remains checked.

Recorded caveat on the exit code: the run was captured through a shell pipeline, so the literal
`EXITCODE=0` that was echoed is the pipeline's status rather than pytest's. The authoritative signal
is the summary line, which reports only passes — `pytest -q` prints a `failed`/`error` component
whenever one exists.

---

## Phase 11 Correction Pass B

Scope: repair the confirmed **Playwright test defects** recorded above, re-run the frontend release
gate against the corrected CI-equivalent definition, and correct the T086 / Quickstart Step 9
documentation so it mirrors the real CI split. **No application production code was changed.** The
`download-url` 500 was deliberately left unfixed (see "Deferred product issue" below), no dependency
remediation was started, and T092/T093 were untouched.

### The two defect classes

Every Playwright failure triaged in this pass reduced to one of two causes, both introduced by
earlier UI phases and never reflected in the tests:

- **RD (responsive dual-render).** `ExpenseHistoryList.tsx:116` renders a desktop
  `<ul className="hidden ... md:block">` and `:177` a mobile `<div className="... md:hidden">`
  wrapping `MobileRecordCard` (`data-testid="mobile-record-card"`). **Both stay in the DOM at every
  viewport** — only CSS decides which is displayed. Playwright resolves locators against the DOM and
  raises strict-mode violations *before* visibility filtering, so any unscoped `getByText` on a
  record matches twice.
- **CS (category select split).** `CategoryPicker.tsx` renders two selects, `aria-label="Category"`
  and `aria-label="Subcategory"`. `getByLabel("Category")` defaults to substring matching, so it
  resolves to both.

Neither is a product defect: the duplicated node is `display:none` and therefore absent from the
accessibility tree. They are test-selector defects.

### Corrections applied (test files only)

| File | Defect | Correction |
|---|---|---|
| `apps/web/tests/e2e/income-expense-flow.spec.ts` | RD x3 | Added `recordRow()` returning `li:visible, [data-testid='mobile-record-card']:visible` filtered by text. `:visible` **is** the proof that the resolved container is the displayed representation, so no bare `.first()` is used. `toHaveCount(1)` retained — one logical record still yields exactly one match. Also fixed two latent failures behind the first: the edit step used `getByLabel("Amount")`, which resolves through the duplicated `id="expense-amount"` to the *create* form outside the row (now `input[name="amount"]` within the row), and the delete step used bare `.first()` (now row-scoped). |
| `apps/web/tests/e2e/categories.spec.ts` | CS, RD, option/row collision | Added `categoryListRow()`; the three catalog-name assertions now target the list row with `exact: true` (keeps `Other` from matching a longer name). Two latent failures behind the first were also fixed: the create/rename assertions collided with the "Parent category" `<option>`, and `getByLabel("Category")` resolved to both selects. |
| `apps/web/e2e/f001-dates.spec.ts` | Stale July fixture | Seeded date now derived from the period under test. **The four typed-date assertions (`2026-07-14` to `14/07/2026`, `2026-07-01` to `01/07/2026`, `2026-07-31` to `31/07/2026`) are unchanged** — they format user input and are period-independent, so exactness is preserved. |
| `apps/web/e2e/mobile-navigation.spec.ts` | Stale July fixture | T062's seeded expense moved from `2026-07-01` to `currentPeriodDate()`. The 44x44 bounding-box assertions are untouched and now genuinely execute. |
| `apps/web/e2e/_helpers/matrix.ts` | — | Added `currentPeriodDate()` and `toDisplayDate()`; `seedIncome` gained an **optional** `occurredOn` that **defaults to the original `2026-07-13`**. |
| `apps/web/e2e/support-purchases.spec.ts` | Portability | Hard-coded `http://localhost:3000` return links replaced with the Playwright `baseURL` fixture. |
| `apps/web/tests/e2e/history.spec.ts` | Portability | `apiBaseUrl` now prefers `process.env.NEXT_PUBLIC_API_URL` before `.env.local`, matching `matrix.ts`. No history assertion or behaviour changed. |

#### Why `page.clock` was not used for the date fixtures

The instruction preferred freezing the clock. **It cannot work here**, and this was verified in
source rather than assumed: `apps/api/app/services/dashboard.py:11` `get_current_period()` derives
the window from server-side `datetime.now(UTC+3)`, and `apps/api/app/routes/dashboard.py` accepts
only `recent_limit` — there is no period parameter. `page.clock` controls the *browser* clock, so it
cannot move a window the API computes in Python. Option (b), deriving the fixture from the tested
current period, was therefore the only viable correction and is the one the instruction also
authorised.

#### Why `seedIncome`'s default was preserved

`e2e/visual-regression.spec.ts:35` seeds through the same helper and its **committed Linux baselines
render `13/07/2026`**. Changing the default would have invalidated snapshots that must not be
regenerated. The optional parameter keeps all seven existing callers byte-identical.

### Scope extension, disclosed

Three further specs — `tests/e2e/{error-states,reports,workspace-switch}.spec.ts` — were **not** in
the instruction's list because Pass A never executed them: they self-skip without `E2E_EMAIL` /
`E2E_PASSWORD`, and CI does not set those. Running the gate *with* credentials surfaced them as
**the same RD and CS classes**, so the identical corrections were applied. This is a deliberate,
disclosed extension of the enumerated scope; it is test-only and each fix was verified by re-run.

`tests/e2e/roles.spec.ts` carried the same RD/CS patterns and was corrected identically. It is gated
on `E2E_MEMBER_*` / `E2E_VIEWER_*` / `E2E_TEAM_WORKSPACE_ID`, which no earlier run supplied — so
rather than leave the edits unverified, an owner/member/viewer team workspace was seeded through the
ordinary signup and member-invite endpoints and the spec was executed:

```
tests/e2e/roles.spec.ts + tests/e2e/categories.spec.ts --project=chromium
  -> 3 passed (21.8s), exit 0
```

That run also executed `categories.spec.ts`'s member/viewer test, which had skipped in every
previous gate. **No edit in this pass is now unverified by execution.**

### The `toHaveCount(1)` assertions still discriminate

Scoping a locator can silently defang a count assertion — a locator resolving to zero would satisfy
`toHaveCount(0)` and could make `toHaveCount(1)` pass vacuously. This was checked rather than
assumed: two expenses sharing one description were created through the API, and the locators were
counted against that page.

| Locator | Count | Meaning |
|---|---|---|
| `page.getByText(desc)` (old, unscoped) | **4** | 2 records x desktop + mobile twins — the strict-mode failure reproduced exactly |
| `li:visible, [data-testid='mobile-record-card']:visible` filtered by text (corrected) | **2** | one match per *logical* record |

Because a genuine duplicate yields 2, `toHaveCount(1)` still fails on a real duplicate. The
double-submit protection assertion retains its meaning.

### T086 frontend gate — corrected definition and result

The former T086 command `npx playwright test e2e --workers=1` did not match CI and conflated two
independent gates. CI (`.github/workflows/ci.yml`) splits them:

**Gate 1 — functional e2e, visual regression excluded** (ci.yml, "Run frontend acceptance tests"):

```bash
cd apps/web && npx playwright test e2e --workers=1 --grep-invert "design refresh visual regression"
```

Scope confirmed with `--list` before running: **33 spec files, 131 tests**, covering both `e2e/` and
`tests/e2e/`, with `visual-regression.spec.ts` excluded.

| Run | Credentials | Result | Duration |
|---|---|---|---|
| CI-equivalent (as CI runs it, no `E2E_*`) | none | **109 passed, 22 skipped, 0 failed, exit 0** | 11.1 min |
| Coverage run (credentials exported) | `E2E_EMAIL`/`E2E_PASSWORD`/`E2E_WORKSPACE_ID` | **115 passed, 3 failed, 13 skipped** — the 3 were the disclosed extension below | 11.4 min |
| Coverage re-run after the extension fixes | same | **118 passed, 13 skipped, 0 failed, exit 0** | 11.3 min |

Web unit half of T086: `npm run test --workspace=@smart-expense/web` — **46 files, 237 tests passed
in 51.86s, exit 0**, unchanged from the pre-correction count.

**The skip count is reported deliberately.** CI sets no `E2E_*` credentials, so
`tests/e2e/{auth,categories,error-states,income-expense-flow,reports,roles,workspace-switch}.spec.ts`
**self-skip in CI**. A CI-green result therefore attests to less than the file count implies, and
the two specs corrected first would have skipped silently had only the CI-equivalent run been used
to justify T086. The credentialed run exists precisely to prove the corrections execute and pass.

**T086 is checked** on the corrected Gate 1 definition, supported by both runs.

**Gate 2 — visual regression, pinned Linux image** is verified as quickstart **Step 9c under T091**,
not as a separate task ID. See below.

### Step 9c visual regression — first attempt (Correction Pass B): NOT RUN

The CI job runs `e2e/visual-regression.spec.ts` inside
`mcr.microsoft.com/playwright:v1.61.1-noble` with `--network host`. The image **is** available
locally (Docker Desktop, linux/amd64) and was pulled and started successfully, but the CI job's
contract is **not faithfully reproducible on this workstation**, for two independent reasons, both
verified rather than assumed:

1. **Networking.** From inside the pinned image with `--network host`, Supabase answered
   (`http://127.0.0.1:54321/auth/v1/health` returned 200) but the API did **not**
   (`http://127.0.0.1:8000/health` returned 000). Docker Desktop's host networking joins the Linux
   VM, not the Windows host, and the API runs as a Windows process. Supabase is reachable only
   because it is itself containerised. (`host.docker.internal` does reach both — 200/200 — but using
   it would require rewriting `NEXT_PUBLIC_*` and rebuilding the web app, i.e. screenshotting a
   differently-configured application.)
2. **Destructive bind mount.** The CI command runs `npm ci` against the bind-mounted workspace. On
   this host that would overwrite `node_modules/` with Linux-native binaries and break every
   subsequent host-side Playwright run. It was therefore **not executed**.

No visual assertion was run, **no snapshot was written or updated**, and no visual result is
claimed. This gate runs green in CI or on a Linux host.

### T091 Quickstart Steps 1-9 — still unchecked

Corrected Step 9 has three parts. 9a (backend + web unit) and 9b (functional e2e) are green; **9c
(pinned-container visual regression) was not run**, for the reasons above. Step 9 is therefore not
complete, so **T091 remains unchecked**. T086 is unaffected: the instruction is explicit that the
ordinary functional gate must not be blocked on Linux screenshots being unrunnable locally.

### Deferred product issue — malformed storage object key causes a 500

Left unfixed in this pass by instruction; recorded so it is not lost.

`GET /workspaces/{id}/files/{file_id}/download-url` returns **500 with an unhandled traceback** when
the row's `storage_path` is not exactly `{uuid}/{uuid}`:
`apps/api/app/services/storage.py:32` `_validate_object_key` raises a bare `ValueError`, but
`apps/api/app/services/files.py:338-341` catches only `storage.StorageError`, so it escapes the
handler. Evidence: `qa-reports/2026-08-01/evidence/api-8001.log:1472` (read, not modified).

**Severity: low.** Not reachable through normal product use — `files.py:217` always writes
`storage_path = f"{workspace_id}/{file_id}"`. Same class as the recorded SEC-07 finding
(`confirm_ai_extraction` returning 500 and leaking `P0002`). The correct fix is to map the
`ValueError` to a clean 4xx/5xx code, not to weaken the validator.

This item is a robustness defect and is **not** a release blocker; it does not affect T086, and it
gates neither T092 nor T093.

### Hosted gates unchanged

**T092 and T093 remain unchecked and were not touched in this pass.** No local or mocked substitute
was introduced for either. No release approval is claimed while they remain open.

---

## Phase 11 Correction Pass C

Scope: two outstanding review corrections, plus making the visual gate period-stable and running it
to completion in the pinned Linux image. **No production frontend or backend code, migration,
dependency, lockfile, or snapshot PNG was changed.** T092/T093 untouched.

### C-1. T086a removed

The invented task ID no longer exists as a task: it is gone from `tasks.md` entirely, and the only
remaining occurrences anywhere in `specs/` are this changelog entry recording its removal. The
numbered-task set is back to the approved **97**, and the Linux visual gate is now
represented exactly as the review asked — as **quickstart Step 9c**, verified under **T091**, with
no task ID of its own.

### C-2. Tenant-isolation assertion restored

`apps/web/tests/e2e/workspace-switch.spec.ts` — the negative cross-workspace check is page-wide
again:

```ts
await expect(page.getByText("Team lunch")).toHaveCount(0);
```

The positive assertion keeps the visibility-scoped locator (it genuinely needed it — it is a
`toBeVisible()` call and tripped strict mode on the desktop/mobile twins). The negative one never
did: `toHaveCount` is a multi-element assertion and does not trip strict mode, so scoping it in
Pass B narrowed a security check for no reason. Page-wide means a leak into a hidden responsive
branch or an off-screen cached render still fails the test.

Focused re-run with owner/member/viewer credentials: **1 passed, exit 0 (16.8s)**.

### C-3. Visual regression made period-stable

**The defect.** `visual-regression.spec.ts` freezes the *browser* clock to 2026-07-13, but the
dashboard's reporting window is computed **server-side** —
`apps/api/app/services/dashboard.py` `get_current_period()` reads `datetime.now(UTC+3)` — and
`GET /workspaces/{id}/dashboard` accepts no period argument. A browser clock cannot pin it. The
baselines were captured in July 2026, so from August the response drifted and the dashboard rendered
`2026-08-01 – 2026-08-31` against a baseline showing `2026-07-01 – 2026-07-31`.

**Why not just re-capture.** Regenerating would re-freeze whatever month the capture ran in and fail
again the following month — the same defect on a one-month timer.

**The fix (test-only).** New helper `apps/web/e2e/_helpers/visual-dashboard.ts`, called once per
test before the first dashboard navigation:

- routes **only** `**/workspaces/*/dashboard*` — no other endpoint, no blanket mocking;
- calls `route.fetch()` to get the **real** response, so the shape and every unrelated field
  (`workspace_id`, `currency`, `pending_ai_count`, …) stay authentic;
- a non-OK upstream response is passed through untouched, so a genuine backend failure still
  surfaces instead of being masked by a synthetic success;
- overwrites only the period and the fields the server derives from it:

| Field | Pinned value | Why |
|---|---|---|
| `period` | `{ start: "2026-07-01", end: "2026-07-31" }` | the window the baselines show; rendered as literal text |
| `summary` | income `125000`, expenses `0`, remaining `125000`, real `currency` | mirrors `seedIncome`'s default record, which is dated `2026-07-13` and is in-period only in July |
| `recent_records` | the one seeded income (fixed placeholder id) | same record; the id is never rendered but is part of the contract |
| `category_breakdown` | `[]` | the dashboard breakdown covers expenses; neither workspace seeds one |

The spec's existing `page.clock.setFixedTime` is kept — it still pins browser-side date reads such
as the income form's default date. Screenshot names, `maxDiffPixelRatio`, and the
mobile-navigation capture are all unchanged; nothing is masked with CSS.

**Why it stays valid after August 2026.** The pinned values are constants, not derived from
`Date.now()` or the server clock, so the captured surface no longer depends on the real month or
year and does not drift across month or year boundaries. `seedIncome`'s default `2026-07-13` is
deliberately left alone — the baselines render that date, and it is also what the pinned summary
describes.

### C-4. Step 9c executed — PASS

Docker Desktop's `--network host` joins the Linux VM rather than the Windows host, so the literal CI
command cannot reach a host-side API here. Everything therefore ran **in Linux**, on the network the
local Supabase stack already uses.

| | |
|---|---|
| Image | `mcr.microsoft.com/playwright@sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48` (`linux/amd64`) |
| Playwright / Chromium | **1.61.1** / **149.0.7827.55** |
| Docker Engine | 29.5.3 |
| Workspace | volume `p11-ws`; tree rsync'd from a **read-only** mount, excluding `node_modules`, `.next`, `.git`, `test-results`, `out`, `.venv` — no host `node_modules` mounted, Linux deps installed only in the volume |
| API | `p11-api` (`python:3.12-slim`) on `supabase_network_smart-expense-ai`, Supabase via aliases `kong` / `db` |
| Web + tests | `p11-pw` (pinned image), same network, `npm ci` → `npm run build` → `npm run start` |

Reachability proved from inside the Playwright container before capturing — including a negative
control taken while the Windows API and web server were **deliberately left running**:

```
localhost:3000/            -> 307      /en/sign-in -> 200
p11-api:8000/health        -> 200
kong:8000/auth/v1/health   -> 200
127.0.0.1:8000  (Windows)  -> 000      <- host process running, unreachable from container
127.0.0.1:54321 (Windows)  -> 000
baselines visible          -> 32
```

Command (CI's, no `--update-snapshots`):

```bash
npx playwright test e2e/visual-regression.spec.ts \
  --workers=1 --project=chromium --project=mobile-rtl --reporter=list
```

**Result: 4 collected · 4 passed · 0 failed · 0 skipped · 1.1 min · exit code 0.**

```
✓ [chromium]   ar screens (21.2s)    ✓ [mobile-rtl] ar screens (11.2s)
✓ [chromium]   en screens (14.3s)    ✓ [mobile-rtl] en screens (10.8s)
```

The Pass B failure (`chromium` / `en` / `en-mobile-navigation-dialog.png`, 4284 px, ratio 0.02) is
resolved. Its secondary header/select-width difference resolved with it, consistent with it having
been a layout consequence of the same July-vs-August data state rather than an independent defect.

**Baselines were not regenerated.** `--update-snapshots` was never passed; the container reported 32
baseline files with none modified, and a per-file content-hash comparison against the Windows tree
came back **byte-for-byte identical for all 32**.

### Host pre-check (Windows)

Run before the Linux gate purely to confirm the interception wires up: the dashboard request was
intercepted, the pinned window rendered (`2026-07-01` / `2026-07-31` present, no real August date),
and there were zero route or request errors. The spec itself stops on Windows at
`*-record-mobile-card` with ~0.04 font-rendering diffs against the Linux baselines — expected, not a
product result, and explicitly not the verdict for Step 9c.

### Status after Pass C

- **T091 — checked.** Quickstart Steps 1–9 complete: 9a, 9b, and 9c all green.
- **T086 — remains checked**, definition unchanged.
- **T092 / T093 — remain unchecked and untouched.** No hosted verification was performed or
  substituted, and no release approval is claimed.

---

## T093 deployed PostgREST smoke — PASSED (2026-08-03)

The one Phase 18 gate that catches hosted dashboard drift. Executed manually against the real hosted
project; the results were supplied in sanitized form and verified against the T093 and EX-5 contracts
before this record was written. **No application code, migration, test, snapshot, or dependency was
touched, and no `service_role` or secret key was used.**

### Environment

| | |
|---|---|
| Hosted project | `https://wyno***.supabase.co` (redacted; not localhost, not the local stack) |
| Credentials | publishable/anon key + ordinary user token — **no `service_role`, no secret key** |
| Token claims | `role=authenticated`, subject present (decoded locally; token never printed or persisted) |
| Migration state | all 14 project migrations applied; local/remote history matched |

### Target — must be 404

`POST {DEPLOYED_URL}/rest/v1/rpc/ensure_personal_workspace`

```json
{ "target_user_id": "00000000-0000-0000-0000-000000000000",
  "target_email":   "t093-probe@example.invalid" }
```

**HTTP 404** ✅

```json
{"code":"PGRST202",
 "details":"Searched for the function public.ensure_personal_workspace with parameters
            target_email, target_user_id or with a single unnamed json/jsonb parameter,
            but no matches were found in the schema cache.",
 "hint":"Perhaps you meant to call the function public.receipt_object_workspace_id",
 "message":"Could not find the function public.ensure_personal_workspace(target_email,
            target_user_id) in the schema cache"}
```

Why this is the strong form of the proof, not a mis-call:

- The arguments sent are the **real live signature** —
  `ensure_personal_workspace(target_user_id uuid, target_email text)`
  (`supabase/migrations/20260624000000_auth_workspace_foundation.sql:96`). A 404 for the correct
  parameter names means the routine is unresolvable in the exposed schema, not that the call shape
  was wrong.
- PostgREST states it searched **`public`** specifically and found no match, which is exactly the
  "no public fallback or duplicate public function resolves" clause.
- The hint offered an unrelated still-public routine (`public.receipt_object_workspace_id`). That is
  incidental but useful: it proves the `public` schema cache is populated and searchable, so the 404
  is relocation-specific rather than an empty or broken cache 404-ing everything.
- The routine was relocated by
  `supabase/migrations/20260731000000_private_schema_privileged_functions.sql:31`
  (`alter function public.ensure_personal_workspace(uuid, text) set schema private`). The hosted
  behaviour matches that migration.

### EX-5 control — must NOT be 404

`POST {DEPLOYED_URL}/rest/v1/rpc/clear_workspace_ai_key`, same host, key, and token.

```json
{ "p_workspace_id": "00000000-0000-0000-0000-000000000000" }
```

**HTTP 403** ✅ (non-404)

```json
{"code":"42501","details":null,"hint":null,"message":"not_owner"}
```

This is the approved control: `clear_workspace_ai_key(p_workspace_id uuid)` is defined at
`supabase/migrations/20260704000000_byok_ai_settings.sql:107`, deliberately **kept in `public`** and
re-created there by `20260732000000_private_schema_rls_helpers.sql:201` with
`grant execute … to authenticated`. It is the same control the local Group EX run used.

Quickstart Step 1 defines the expected control result as "**not** 404 — a 4xx from the function's own
role check, or 200". A `42501 not_owner` is precisely that: the function **resolved** and reached its
own authorization logic. Without this, a project that 404-ed every RPC would have made the target
result vacuous — the exact failure mode EX-5 exists to catch.

`not_owner` rather than `401` additionally corroborates that the bearer token authenticated as a real
end user, independently of the decoded `role` claim.

### Contract assessment

| T093 / EX-5 clause | Result |
|---|---|
| Target RPC returns 404 | ✅ 404 |
| PostgREST reports the routine is not exposed / unresolvable | ✅ `PGRST202`, searched `public`, no match |
| No public fallback or duplicate public function resolves | ✅ explicitly none in `public` |
| Approved control RPC returns non-404 | ✅ 403 |
| Both reached the real hosted project | ✅ PostgREST `PGRST202` + Postgres `42501` from the hosted host |
| Ordinary-user authentication confirmed | ✅ `role=authenticated`, subject present, corroborated by `not_owner` |
| No privileged key used | ✅ publishable key + user token only |
| No meaningful data changed | ✅ see below |

**No mutation.** The target returned 404 *before* invocation, so its body never executed. The control
was called with a nil workspace id that matches no row and aborted at its owner check (`42501`)
before any write. Neither call could alter data.

### Scope limit — this is not T092

**T093 is closed; T092 is not.** A passing smoke is strong evidence that `private` is not exposed at
this moment, but it is a point-in-time probe, not the recorded Dashboard exposed-schema evidence that
FR-038/SC-018 require, and it cannot detect drift introduced after the probe. T092 still requires
opening **Project Settings → API → Exposed schemas**, confirming `public, graphql_public` without
`private`, and attaching that evidence to the release record.

**No production release approval is claimed while T092 remains open.**

### Secret handling

Only sanitized values were recorded: the host is redacted to `https://wyno***.supabase.co`, and the
publishable key and user token were never printed, logged, or persisted in any file in this
repository. The JWT was decoded locally for its `role` and subject-presence claims only.

---

## T092 hosted exposed-schema evidence — PASSED (2026-08-03)

The gate FR-038/SC-018 exist for: `supabase/config.toml:11` governs only the local stack, so the
hosted project's exposed-schema list is the single setting that decides whether every routine
relocated in this phase is reachable from the browser. If `private` is ever selected there, the whole
phase silently reverts to exploitable with no code change and no failing test.

**Evidence artifact:** a hosted Dashboard screenshot of the Data API settings panel, **reviewed as
external release evidence on 2026-08-03** — opened and read directly rather than accepted from a
description. It is retained with the release record and deliberately **not** committed to this
repository, so no path here points at a local-only, untracked file.

### What the artifact shows

Hosted Supabase Dashboard → **Integrations → Data API → Settings**, Exposed-schemas picker open:

| Schema | Exposed? |
|---|---|
| `graphql_public` | ✅ ticked |
| `public` | ✅ ticked |
| **`private`** | ❌ **listed but NOT ticked** |

Summary control reads **"2 of 3 schemas exposed"** — exactly the required `public, graphql_public`.
`private` appearing in the picker is expected (this phase creates the schema); the contract is that
it is never *selected*.

Additionally visible: **Extra search path** = `PUBLIC, EXTENSIONS`, which does **not** include
`private` — so relocated routines are not reachable by search-path resolution either.

### Contract assessment

| T092 / FR-038 / SC-018 clause | Result |
|---|---|
| Exposed-schema list confirmed on the target deployment environment | ✅ hosted Dashboard, Data API settings |
| List is `public, graphql_public` | ✅ "2 of 3 schemas exposed", both ticked |
| List excludes `private` | ✅ present but unticked |
| Positive documented evidence attached to the release record | ✅ screenshot artifact retained |
| Local config not substituted for hosted evidence | ✅ `supabase/config.toml` was not used |

### Two honest limits of the artifact, and why the gate still holds

1. **The screenshot does not self-identify the project.** The captured region shows no project name
   or ref, so on its own it does not prove *which* project it is.
2. **It shows UI state, not proof of a saved write.** The picker is open with a Cancel control
   present, so the image alone cannot distinguish a saved setting from an unsaved edit.

Both are resolved by **T093**, which is independent and behavioural: a live
`POST /rest/v1/rpc/ensure_personal_workspace` against `https://wyno***.supabase.co` returned
**404 / PGRST202** with PostgREST reporting it searched `public` and found no match. A project with
`private` exposed could not produce that result, and an unsaved setting could not either. The
settings evidence and the runtime probe corroborate each other; **neither alone would be
conclusive, and together they are.**

### Standing caveat

T092 and T093 are both **point-in-time**. Re-capture this setting and re-run the smoke after any
Supabase project configuration change — dashboard drift is precisely the failure mode these two
gates exist to catch, and nothing in CI will detect it.

### Related posture observation — not a T092 failure

**Automatically expose new tables** is **enabled** in the same panel, and the Dashboard itself
recommends disabling it. This is outside the T092 contract: it governs table exposure, not schema
exposure, and since `private` is not exposed nothing in it becomes reachable. The practical effect is
that any *future* table created in `public` is exposed by default rather than by deliberate choice.
Recorded as a hardening follow-up for a later phase, not a blocker here.
