# Implementation Plan: Security Remediation and Production Hardening

**Branch**: `018-security-remediation-hardening` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/018-security-remediation-hardening/spec.md`

## Summary

Phase 18 closes the four **confirmed** vulnerabilities from the post-Phase-17 security audit and
applies the minimum production hardening required before the product may run anywhere holding real
user data or real payment-provider credentials.

All four confirmed vulnerabilities share one root cause. `supabase/config.toml:11` sets
`schemas = ["public"]`, so Supabase's PostgREST publishes **every** `public`-schema function granted
to `authenticated` as an HTTP endpoint at `POST {SUPABASE_URL}/rest/v1/rpc/<name>`. The browser
already holds `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` plus a live user token,
so any signed-in user can invoke backend-only routines directly. Because those routines are
`SECURITY DEFINER` and no table uses `FORCE ROW LEVEL SECURITY`, direct invocation runs as the table
owner and bypasses RLS entirely.

The fix is one migration plus four call-site updates:

1. Create a `private` schema that PostgREST does not publish.
2. Relocate the four offending functions into it with `ALTER FUNCTION ... SET SCHEMA`, keeping
   `USAGE` + `EXECUTE` for `authenticated` so the backend's existing RLS-bearing connection and all
   RLS policies keep working. **No service-role key is introduced.**
3. `CREATE OR REPLACE` the one dependent function body that resolves a moved function by name
   (`handle_new_user` → `ensure_personal_workspace`).
4. Add an independent, NULL-tolerant identity guard inside `ensure_personal_workspace` so the
   Critical finding stays closed even if the schema-publication setting regresses in a hosted
   environment.

The central technical asymmetry, verified in [research.md](./research.md) R-002 and **proven by task
before any real migration is written**: RLS policy expressions are OID-bound and follow a relocated
function automatically, but plpgsql / traditional `LANGUAGE sql` bodies are name-bound text resolved
at execution time and fail *at runtime* if not re-created. This is why relocating
`workspace_role_for` and `is_workspace_member` — ~55 references including **five** function-body
references reaching AI settings and extraction confirm — is deliberately **deferred** to a P3 story
outside the release gate.

Hardening adds per-account throttling on the four costly endpoints, fixes the log-redaction filter's
attachment level, pins the accepted JWT algorithm to trusted key material, closes the docs surface
in production, makes `/health` stop spending a service-role credential per probe, and pins CI
actions.

This phase changes **no product behaviour**. The single intentional interface addition is a
localised throttling message. Anything else observable is a defect in this phase.

**This phase is planning only — no application code, migration, test, or CI change is implemented
here.**

## Technical Context

**Language/Version**: Python 3.12 / FastAPI 0.138.0 (`apps/api`); PostgreSQL 15 via Supabase
(`supabase/migrations`); TypeScript / Next.js 16 (`apps/web`, message catalogues only). No new
languages or runtimes.

**Primary Dependencies**: **No new dependencies.** Existing `PyJWT[crypto]==2.10.1` covers the
algorithm-pinning work; the rate limiter is ~50 lines of standard library
([research.md](./research.md) R-007) specifically to avoid adding `slowapi`/`limits`; the log fix is
a re-attachment of the existing `SensitiveDataFilter`.

**Storage**: Existing Supabase Postgres. **No new tables, columns, indexes, or persisted state.**
The only schema-level change is a new empty `private` namespace holding relocated functions.
Throttling counters live in process memory and are deliberately not persisted.

**Testing**: `pytest` 9.0.2 + `pytest-asyncio` (`apps/api/tests/`, `apps/api/pytest.ini`);
Playwright for `apps/web` e2e. Existing suites are the regression baseline and their assertions must
not be modified (spec FR-039).

**Target Platform**: Linux containers on Bunny Magic Containers (`infra/bunny/api.Dockerfile`);
hosted Supabase for database, auth, Vault, and storage.

**Project Type**: Monorepo — FastAPI backend, Next.js web, Capacitor mobile, Supabase migrations.
This phase touches the backend and migrations, plus two web message catalogues. **`apps/mobile`
requires no change**: it consumes the same backend endpoints and holds no privileged RPC call sites
(verified — no `rest/v1/rpc` usage anywhere in `apps/mobile/src`).

**Performance Goals**: No regression. Two changes should measurably *improve* things: `/health` stops
making a 3-second-timeout outbound call per probe, and throttling bounds worst-case load on the four
protected endpoints. Throttling adds a dictionary lookup per request.

**Constraints**:
- The backend MUST keep using its existing `role = authenticated` connection; introducing the
  service-role key for relocated calls is prohibited (spec FR-003).
- `EXECUTE` MUST NOT be revoked from `authenticated` on the shared RLS helpers — every RLS policy
  evaluates them as the requesting user (spec FR-011).
- Migrations MUST be guarded/idempotent: the developer's local database has diverged from the
  tracked migration history, so a bare `ALTER FUNCTION` would abort.
- Reversal SQL MUST NOT live in `supabase/migrations/`, which `supabase db reset` replays.
- No new infrastructure dependency (spec Out of Scope).

**Scale/Scope**: 1 new migration; ~7 backend files changed; 2 web message files; 4 backend RPC call
sites re-qualified; 1 dependent function body re-created; 2 functions relocated with zero references
and 2 with one reference each. Roughly 55 RLS/body references to the deferred helpers are
**inventoried but untouched**.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — see bottom of section.*

| Principle | Assessment |
|---|---|
| **VI. Privacy and Security** | **This phase exists to serve it.** "No API key exposure to the frontend" is currently violated by H1: any workspace Member can retrieve the Owner's plaintext BYOK key from the browser. "Database-level access control where applicable" is violated by C1. **PASS — corrective.** |
| **VII. Workspace and Multi-Tenant Isolation** | "Users MUST NEVER access data from workspaces they do not belong to" is currently reachable via the C1 → invite-hijack chain. Spec FR-010 and SC-006 require byte-identical role decisions before and after. **PASS.** |
| **IX. Architecture Authority** | Reinforced: authorization moves further behind the trusted FastAPI backend rather than being reachable directly by clients. **PASS.** |
| **X. Financial Accuracy (NON-NEGOTIABLE)** | No calculation, amount, or currency logic is touched. Throttling is proven to refuse **before** any purchase or financial state change (spec FR-018, SC-010). **PASS.** |
| **XIII. Free Product and Optional Support** | Throttling allowances apply equally to every account and are ~10x realistic use — they are cost controls, not product limits, and gate no feature. **PASS.** |
| **XIV. Testing Requirements** | Directly serves two named NON-NEGOTIABLE must-cover rules: "users must not access another workspace's data" and "API keys must never be exposed to the frontend". Adds a security regression suite (spec FR-037). **PASS.** |
| **XV. Scope Control** | "Security" is an explicitly allowed feature category. No new product surface. **PASS.** |
| **XVI. Spec-Kit Workflow** | spec → clarify → plan → tasks → analyze completed before any implementation. **PASS.** |
| **IV. Saudi-First / Arabic-first** | The one new user-visible string ships in both `ar.json` and `en.json` (spec FR-025, SC-019). **PASS.** |
| **Technology Constraints** | No new technology. A shared counter store (Redis) was explicitly rejected because it would add infrastructure absent from this section and would require its own specification. **PASS.** |

**Initial gate: PASS — no violations, Complexity Tracking not required.**

**Post-design re-check (after Phase 1): PASS.** The design added no table, no dependency, no
service, and no new external integration. The one deliberate deviation from "no product behaviour
change" — the localised throttling message — is recorded in the spec's Assumptions and covered by
SC-019, so it is a disclosed decision rather than scope creep. The deferred P3 story is explicitly
outside the release gate, so the blocking scope did not grow during design.

## Project Structure

### Documentation (this feature)

```text
specs/018-security-remediation-hardening/
├── spec.md                      # Feature specification (complete)
├── plan.md                      # This file
├── research.md                  # Phase 0 — R-001..R-013 decisions
├── data-model.md                # Phase 1 — schema/permission model, no new tables
├── quickstart.md                # Phase 1 — manual verification & release gate
├── rollback.sql                 # Authored during IMPLEMENTATION alongside the migration,
│                                #   not by planning — it reverses a migration that does not
│                                #   yet exist. Its required contents and split are specified
│                                #   in contracts/private-schema-migration.md § Reversal.
│                                #   NEVER placed in supabase/migrations/ (see FR-013).
├── contracts/
│   ├── private-schema-migration.md   # Migration contract, order, guards, proof obligations
│   ├── rate-limiting.md              # Endpoint allowances, refusal contract, ordering guarantee
│   └── security-regression-tests.md  # Required assertions mapped to FR/SC
├── checklists/
│   └── requirements.md          # Spec quality checklist (complete)
└── tasks.md                     # Phase 2 output — /speckit-tasks, NOT created here
```

### Source Code (repository root)

Files this phase will touch. Everything else in the repository is out of scope.

```text
supabase/
├── config.toml                              # VERIFY only — schemas = ["public"] must stay as-is
└── migrations/
    └── 20260731000000_private_schema_privileged_functions.sql   # NEW — the only migration

apps/api/
├── app/
│   ├── main.py                    # docs_url/redoc_url/openapi_url gated by environment
│   ├── core/
│   │   ├── auth.py                # L105-121 algorithm pinning; L144 private.; L30-37 predicate
│   │   ├── config.py              # shared environment predicate + rate-limit settings
│   │   ├── logging.py             # L28-33 filter moved from loggers to handlers
│   │   └── rate_limit.py          # NEW — in-process fixed-window limiter dependency
│   ├── routes/
│   │   ├── health.py              # L16-31 drop outbound call + service-role key; async def
│   │   ├── support_purchases.py   # limiter on :444 and :520; idempotency key at :476
│   │   ├── extractions.py         # limiter on the trigger route
│   │   ├── reports.py             # limiter on the ai-summary route
│   │   └── workspace_members.py   # L142 → private.find_user_profile_by_email
│   └── services/
│       ├── extractions.py         # L245 → private.get_workspace_ai_key_for_extraction
│       └── ai_summary.py          # L63  → private.get_workspace_ai_key_for_extraction
└── tests/
    ├── test_private_schema_exposure.py     # NEW — FR-001/037, SC-001
    ├── test_identity_guard.py              # NEW — FR-008, SC-002
    ├── test_rate_limits.py                 # NEW — FR-017..025, SC-010/011
    ├── test_log_redaction.py               # NEW — FR-026/027, SC-012
    ├── test_jwt_algorithm_pinning.py       # NEW — FR-028/029, SC-013
    └── test_production_surface.py          # NEW — FR-030..033, SC-014/015

apps/web/
└── messages/
    ├── en.json                    # errors.rateLimited
    └── ar.json                    # errors.rateLimited

.github/workflows/
└── ci.yml                         # P3 — SHA-pin actions, add dependency audit
```

**Structure Decision**: No structural change. This phase edits existing files in place and adds one
migration, one backend module (`core/rate_limit.py`), and six test modules. `apps/mobile` and
`packages/shared` are untouched. New tests follow the existing flat `apps/api/tests/test_*.py`
convention rather than introducing a new directory layout.

## Implementation Approach

### Stage A — Prove the database mechanics before writing the real migration (blocking)

Nothing else may start until this is done, because the entire migration design rests on one
PostgreSQL behaviour and one failure mode ([research.md](./research.md) R-002):

1. On a **disposable** database, create a function, a policy that calls it, and a second function
   whose body calls it by name. `ALTER FUNCTION ... SET SCHEMA`. Assert the **policy still enforces**
   (OID-bound) **and** the **dependent body now fails** (name-bound).
2. Record the result in `contracts/private-schema-migration.md`. If OID-following does **not** hold,
   switch to the documented fallback (explicitly drop/recreate all affected policies in dependency
   order) and re-scope — this would materially change the task breakdown.

This ordering is deliberate: the cheap experiment either validates a one-migration change or reveals
early that the change is far larger.

### Stage B — The migration (single file, guarded, ordered)

`supabase/migrations/20260731000000_private_schema_privileged_functions.sql`, in this exact order
(spec FR-016):

1. `create schema if not exists private;`
2. `grant usage on schema private to authenticated;` — required because RLS policies and the backend
   both execute as `authenticated`.
3. Guarded relocation of the four functions, each wrapped in a `pg_proc`/`pg_namespace` existence
   check so the migration converges from a clean reset **or** from the diverged local database:
   `ensure_personal_workspace(uuid,text)`, `get_workspace_ai_key_for_extraction(uuid)`,
   `find_user_profile_by_email(text)`, `shares_workspace_with(uuid,uuid)`.
4. Re-grant `execute` on each relocated function to `authenticated`; `revoke` from `public, anon`.
5. `create or replace function public.handle_new_user()` — the **one** dependent body, changing
   `public.ensure_personal_workspace` → `private.ensure_personal_workspace`.
6. `create or replace function private.ensure_personal_workspace(...)` adding the identity guard
   from R-004. Body references only `public.*` objects, so `set search_path = public` remains
   correct.

Each step is safe if the migration aborts midway: schema and grants are inert alone, and a
relocation without its body rewrite fails **closed** (the dependent flow errors loudly) rather than
open (no security control is silently lost).

**Explicitly NOT in this migration**: any change to `workspace_role_for`, `is_workspace_member`, or
any RLS policy. Zero `create policy` / `drop policy` statements. That is the single strongest
guarantee that tenant isolation is unaffected, and reviewers should check for it.

### Stage C — Backend call sites

Four one-line re-qualifications, each of which fails loudly and immediately if missed, since the
function no longer exists in `public`:

| File:line | Change |
|---|---|
| `apps/api/app/core/auth.py:144` | `public.` → `private.ensure_personal_workspace` |
| `apps/api/app/routes/workspace_members.py:142` | `public.` → `private.find_user_profile_by_email` |
| `apps/api/app/services/extractions.py:245` | `public.` → `private.get_workspace_ai_key_for_extraction` |
| `apps/api/app/services/ai_summary.py:63` | `public.` → `private.get_workspace_ai_key_for_extraction` |

One behavioural detail to preserve: `_repair_personal_workspace`
(`apps/api/app/core/auth.py:130-152`) catches `DBAPIError` and returns early when
`_personal_workspace_exists` is true. After the identity guard is added, a `42501 identity_mismatch`
would be swallowed by that same handler. That is acceptable — the backend only ever passes the
caller's own id, so the guard can only fire on a genuine bug — but the test must assert the guard by
calling the function directly, not through the endpoint, or it will silently pass.

### Stage D — Rate limiting

`apps/api/app/core/rate_limit.py`: a fixed-window counter keyed on `(user_id, bucket_name)`, applied
as a **route-level** dependency (`@router.post(..., dependencies=[Depends(...)])`). FastAPI inserts
decorator-level dependencies at the front of the dependant list, so they resolve before the
endpoint's own `get_trusted_session` / `get_rls_session` — which is what mechanically guarantees the
refusal happens before any transaction, any `create_pending`, and any provider call (spec FR-018).
**This ordering must be asserted by test, not assumed.**

Allowances per hour per account: checkout 5, mobile verify 10, extraction trigger 30, AI summary 10.
Refusal is HTTP 429 with `{"error": {"code": "rate_limited", ...}}`, no threshold or remaining-window
disclosure. Webhook routes get **no** limiter (spec FR-021). Fail closed on internal limiter error.

Separately, replace the `uuid4()` component of the Stripe idempotency key
(`apps/api/app/routes/support_purchases.py:476`) with a stable derivation so a double-submit
collapses instead of minting a second Checkout Session.

### Stage E — Operational hardening

Independent, small, each with its own test: log filter re-attached to handlers
(`core/logging.py`); JWT algorithm pinned from the resolved JWK plus `TypeError` added to the caught
tuple (`core/auth.py:105-122`); docs surface gated (`main.py:28`); `/health` reduced to liveness
(`routes/health.py`); environment predicate centralised in `core/config.py` and reused by the docs
gate and the diagnostics gate so they cannot drift.

Before disabling the docs surface, confirm no existing test asserts on `/openapi.json`, `/docs`, or
the current `/health` `dependencies.database` payload shape — removing them must not silently break
a passing test.

### Stage F — P3, droppable

Deferred helper relocation (only with the full inventory in hand, and abandoned rather than forced
if anything breaks); the two default-`PUBLIC` grant tightenings; CI SHA-pinning and dependency
audit.

## Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| A function body referencing a moved function by name is missed → **runtime** failure, invisible at migration time | **High** | Exhaustive grep already done: exactly **one** body reference exists (`handle_new_user`). Stage A proves the failure mode deliberately so the team recognises it. Quickstart exercises signup explicitly. |
| Hosted `private` accidentally added to exposed schemas → every fix silently reverts, no failing test | **High** | Three layers: R-004's independent identity guard survives it for the Critical finding; recorded release-gate evidence (spec FR-038); post-deploy smoke assertion against the **deployed** URL. |
| OID-following assumption wrong → all ~55 policy references break | **High** | Stage A proves it on a disposable DB **before** the real migration exists. Documented fallback: explicit policy drop/recreate. |
| Someone "fixes" the deferred helpers by revoking `EXECUTE` | **Critical** | Every RLS policy evaluates them as the requesting user → total outage. Recorded as spec FR-011 (a MUST NOT), in research R-001, and to be repeated as an inline migration comment. |
| Identity guard breaks new signups (`auth.uid()` NULL on the trigger path) | **High** | `is not null and is distinct from` shape (R-004). Dedicated signup test; quickstart step. |
| Migration aborts against the diverged local database | Medium | `pg_proc`/`pg_namespace` guards; idempotency asserted by applying twice (spec SC-016). |
| Throttling refuses a legitimate user | Medium | Allowances ~10x realistic use; per-account scoping; window-expiry test. |
| Throttling silently loses a provider webhook | **High** | Webhook routes deliberately unlimited (spec FR-021); asserted by test (SC-011). |
| Reversal SQL placed in `supabase/migrations/` → `supabase db reset` undoes the fix every rebuild | **High** | Reversal lives in `specs/018-.../rollback.sql`; no reversal file in the migrations directory. |
| Per-instance counters multiply the effective allowance | Low | Accepted and documented (spec FR-023), not hidden. |
| Disabling docs breaks an existing test | Low | Explicit pre-check task before the change. |

## Release Gates

All must hold before this phase is considered complete:

1. Full existing `pytest`, Vitest, and Playwright suites pass with **no assertion modified**
   (spec FR-039).
2. The new security regression suite passes, including the four direct-RPC rejections (SC-001).
3. Role-permission and tenant-isolation suites produce identical decisions to the pre-change
   baseline for all four roles plus non-members (SC-006).
4. Signup bootstrap, personal-workspace repair, invite-by-email, AI extraction, and AI summary all
   verified working (SC-007, SC-008, SC-009).
5. The migration applied twice in succession yields the same end state (SC-016).
6. `rollback.sql` executed on a disposable database and verified to restore the prior state.
7. **Recorded evidence** that the target environment's exposed-schema list excludes `private`
   (SC-018) — an API-settings dump or screenshot, not an assertion.
8. Zero `create policy` / `drop policy` statements in the migration.
9. Grep confirms no `public.ensure_personal_workspace`, `public.find_user_profile_by_email`,
   `public.get_workspace_ai_key_for_extraction`, or `public.shares_workspace_with` call sites remain
   in `apps/api`.

**Explicitly NOT a release gate**: Phase 17's T052 manual purchase sweep, live Stripe/Apple/Google
sandbox testing, and User Story 7 (deferred helper relocation) — all out of scope per spec.

## Complexity Tracking

Not required — the Constitution Check passed with no violations, before and after design.
