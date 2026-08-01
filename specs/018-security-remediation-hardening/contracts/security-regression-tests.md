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
| EX-7 | `public.workspace_role_for` and `public.is_workspace_member` are still in `public` and still executable by `authenticated` | FR-011, FR-034 | — |

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

## Not tested here, by design

| Item | Why | Where it is covered |
|---|---|---|
| Hosted exposed-schemas setting | Not observable from a local test — dashboard config outside version control | Release gate with recorded evidence (spec FR-038, SC-018); quickstart step |
| Live Stripe/Apple/Google sandbox purchases | Out of scope (spec Out of Scope); Phase 17 T052 stays open | Not covered — must not be claimed |
| Deferred helper relocation | P3, droppable (spec FR-034) | Only if User Story 7 is attempted |
