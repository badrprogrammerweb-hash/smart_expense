# Implementation Plan: BYOK AI Settings

**Branch**: `007-byok-ai-settings` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-byok-ai-settings/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a workspace-scoped "Bring Your Own Key" (BYOK) AI settings surface on top of
the Phase 2–6 workspace/membership foundation. A new `workspace_ai_settings`
table (one row per workspace — `workspace_id` is the primary key, enforcing "at
most one active configuration per workspace") holds only **non-secret** metadata:
the selected provider (`gemini` or `openai`), a reference to the stored secret, a
`key_last4` masked hint, and who/when it was last changed. The raw API key is
stored in **Supabase Vault** (constitution VI, mandatory) and is **never** stored
in application tables, returned to any client, or written to any log.

Because Supabase Vault is SQL-only, all secret writes go through two
`SECURITY DEFINER` SQL functions — `public.set_workspace_ai_key(...)` and
`public.clear_workspace_ai_key(...)` — invoked from the existing authenticated
RLS session (the same pattern as `unlink_files_on_expense_soft_delete` already in
the tree). Each function performs its own **Owner-only** authorization via the
existing `public.workspace_role_for(workspace_id, auth.uid())` helper, then calls
`vault.create_secret` / `vault.update_secret` (verified against the live stack —
see research.md) with elevated rights the caller does not have. The FastAPI
service also performs an explicit Owner check before calling the RPC (defense in
depth; constitution IX: RLS/DB checks alone are not sufficient).

The backend exposes three endpoints under `/workspaces/{workspace_id}/ai-settings`
— `GET` (status, all members incl. Viewer), `PUT` (configure/replace/switch,
Owner-only), and `DELETE` (remove, Owner-only). The key is never read back in
this phase (no AI calls exist yet); `GET` returns only status metadata. Inbound
keys use Pydantic `SecretStr` and undergo **lightweight shape-only validation**
(provider-appropriate prefix/length/charset) with **no live provider call**
(deferred to Phase 8). The frontend adds an AI settings card to the existing
workspace settings page: a read-only status for all members and an Owner-only
provider-select + key-input form and a remove-key confirmation. All manual
workflows (income, expense, category, file, report) are untouched and never
depend on BYOK (constitution V; FR-017).

## Technical Context

**Language/Version**: Python 3.12 for `apps/api` (extended this phase); SQL
(Postgres 15, Supabase-managed) for one new migration under
`supabase/migrations/`; TypeScript 5.7 on Next.js 16.x (App Router) / React 18.3
for `apps/web` (extended this phase). This phase touches `apps/api`, `apps/web`,
and `supabase/`.

**Primary Dependencies**:
- Backend: FastAPI, SQLAlchemy async engine + `asyncpg`, `PyJWT[crypto]`,
  Pydantic v2 (`SecretStr` used for the inbound key) — all already in
  `apps/api/requirements.txt`. Supabase Vault is reached through **normal SQL**
  over the existing authenticated RLS session (`get_rls_session`) by calling the
  two new `SECURITY DEFINER` wrapper functions. **No new Python package is
  required** and, unlike Phase 6 Storage, **no service-role REST path is used** —
  Vault has no REST surface.
- Frontend: already-present `next`, `react`, `@supabase/supabase-js` +
  `@supabase/ssr`, `@tanstack/react-query`, `react-hook-form` + `zod`,
  `next-intl`, `shadcn/ui` + Tailwind (Phase 5 stack) — reused unchanged. No new
  frontend dependency.

**Storage**:
- Supabase Postgres — one new table `public.workspace_ai_settings`
  (workspace-scoped, RLS-enabled, `workspace_id` PK/FK to `workspaces`
  `on delete cascade`, `updated_by` FK to `user_profiles`). Columns hold only
  non-secret metadata (provider, `vault_secret_id`, `key_last4`, timestamps,
  updater).
- Supabase Vault — the raw API key is stored as a Vault secret named
  deterministically per workspace (e.g. `workspace_ai_key:{workspace_id}`).
  `workspace_ai_settings.vault_secret_id` references `vault.secrets.id`. The
  `vault.decrypted_secrets` view is **never** granted to `anon`/`authenticated`
  and is never queried in this phase.
- Supabase Storage — **not used** by this phase.

**Testing**: `pytest` + `pytest-asyncio` + `httpx` (ASGI transport) for
route-level backend tests, same pattern as Phases 2–6; integration tests sign in
as real local-Auth test users via the Supabase CLI stack to exercise RLS, the
`SECURITY DEFINER` RPCs, and role permissions directly against the local Vault.
Frontend: Vitest + React Testing Library for component/permission/empty-state
tests and Playwright for the configure→view-status→replace→remove e2e flow
(Phase 5 test stack, reused).

**Target Platform**: Local development via Supabase CLI (Docker stack already
running locally); hosted Supabase for staging/production; `apps/web` in the
browser (desktop + mobile web). Unchanged deployment posture (Bunny Magic
Containers hosting is Phase 10).

**Performance Goals**: No raw throughput/latency SLA. SC-001 (Owner sees
"configured" in under 1 minute) is an end-to-end, human-paced budget, not an API
latency target, consistent with prior phases.

**Constraints**:
- The raw API key MUST be stored **only** in Supabase Vault, encrypted at rest,
  and MUST NEVER be returned to any client or written to any log/error/diagnostic
  output (constitution VI, XIV; FR-006–FR-010, FR-024).
- Exactly one provider + one key per workspace; `workspace_id` PK enforces this
  at the schema level (FR-002). A configured state requires **both** provider and
  key (FR-003).
- Configure / replace / remove: **Owner only**, enforced in the `SECURITY
  DEFINER` RPC **and** re-checked in the FastAPI service before the RPC call
  (constitution IX; FR-020, FR-022; Clarifications). View status: all members
  incl. Viewer (FR-021; Clarifications).
- Key validation is **shape-only**; a valid-shape but wrong/revoked key is
  accepted this phase; **no live provider call** is made (FR-004, FR-005;
  Assumptions). Real verification is Phase 8.
- Replace/switch destroys the previous secret and keeps no prior-key history
  (FR-013; Clarifications). Same-provider rotation uses `vault.update_secret`
  (overwrites in place, keeps the same `vault_secret_id`, no missing-secret
  window); first-time configuration uses `vault.create_secret`.
- Tenant isolation: one workspace's AI configuration/status is never readable or
  mutable from another workspace; unauthenticated requests are denied
  (constitution VII; FR-023).
- Manual-first: no manual workflow depends on BYOK; financial totals and the
  remaining-balance calculation are untouched (constitution V, X; FR-017–FR-019).
- No AI extraction, AI calls, or any AI-powered behavior this phase (FR-018; spec
  Out of scope). No general activity/history feed is built (Phase 9 scope).

**Scale/Scope**: 1 new table + 2 new `SECURITY DEFINER` functions + RLS/grants in
1 new migration; ~3 new backend endpoints (get status, put configure/replace,
delete remove) in a new `ai_settings` router/service/schema; new frontend AI
settings card + status/form/remove components + api client + one permission
helper + en/ar strings. No changes to income/expense/file financial or storage
code paths.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Core Product Principle | PASS | BYOK/optional AI is explicitly in the MVP surface; no accounting/banking/payment behavior added. |
| III. MVP Scope Discipline | PASS | Only provider selection + secure key lifecycle + settings UI. No AI calls, no activity feed, no usage metering. |
| V. Manual-First, AI-Optional | PASS | App is fully usable with zero BYOK; configuring a key triggers no AI behavior; totals unaffected (US5, FR-017–FR-019). |
| VI. Privacy and Security | PASS | Key stored in **Supabase Vault** (mandated), encrypted at rest; never returned to the frontend; never logged; RLS on the metadata table; every mutation validated on the backend, not RLS-only. |
| VII. Multi-Tenant Isolation | PASS | `workspace_id` PK/FK; RLS + `workspace_role_for` scope every op; RPCs assert workspace ownership; cross-workspace read/write denied (FR-023). |
| IX. Architecture Authority | PASS | Backend + Postgres/Vault are source of truth; frontend is display-only and never receives the key; Owner check enforced in both the RPC and the service layer. |
| X. Financial Accuracy | PASS (untouched) | No money math changes; BYOK state never affects any total or the remaining balance (FR-019). |
| XII. History Tracking | PASS (scoped) | Record-level updated-by/updated-at traceability now; a general activity feed is explicitly deferred to Phase 9 (no activity table exists yet). |
| XIV. Testing Requirements | PASS | Plan mandates dedicated tests for AI **key security** (no exposure/logging), role permissions, tenant isolation, and manual-first behavior (SC-002/003/004/005/006/007/008). |
| XV / XVI. Scope Control / Spec-Kit | PASS | Focused spec+plan for this feature only; out-of-scope items enumerated; sequenced after Phase 6, before Phase 8. |

No violations. Complexity Tracking table is intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/007-byok-ai-settings/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── ai-settings-api.md   # FastAPI endpoints (GET status / PUT configure-replace / DELETE remove)
│   └── vault-rpc.md         # SECURITY DEFINER SQL contract (set/clear) + table + RLS + grants
├── checklists/
│   └── requirements.md  # Spec quality checklist (/speckit-specify output)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── routes/
│   │   └── ai_settings.py        # NEW: GET/PUT/DELETE /workspaces/{id}/ai-settings
│   ├── services/
│   │   └── ai_settings.py        # NEW: owner check + shape validation + RPC orchestration + redaction
│   └── schemas/
│       └── ai_settings.py        # NEW: AiProvider enum, AiSettingsStatus, AiSettingsUpdateRequest (SecretStr)
└── tests/
    ├── test_ai_settings_configure.py       # NEW: configure gemini/openai, shape validation, provider+key required
    ├── test_ai_settings_secrecy.py         # NEW (DEDICATED, SC-002/008): key never in any response, error, or log
    ├── test_ai_settings_replace.py         # NEW: rotate same provider, switch provider, prior secret destroyed (SC-006)
    ├── test_ai_settings_remove.py          # NEW: remove destroys secret, not-configured, no-op when none (SC-005)
    ├── test_ai_settings_authorization.py   # NEW: non-owner PUT/DELETE denied; all members GET (SC-003)
    └── test_ai_settings_isolation.py       # NEW: cross-workspace read/write denied; anon denied (SC-007)

supabase/migrations/
└── 20260704000000_byok_ai_settings.sql     # NEW: workspace_ai_settings table + RLS, set/clear SECURITY DEFINER RPCs, grants

apps/web/
├── app/[locale]/w/[workspaceId]/settings/
│   └── page.tsx                  # EDIT: mount the AI settings card
├── components/settings/
│   ├── AiSettingsCard.tsx        # NEW: composes status + form + remove; gates by role
│   ├── AiKeyStatus.tsx           # NEW: provider, masked hint, last-updated, configured badge (all members)
│   ├── AiProviderKeyForm.tsx     # NEW: provider select + key input + save (Owner only)
│   └── RemoveAiKeyDialog.tsx     # NEW: Owner-only confirm remove
├── lib/api/
│   └── ai-settings.ts            # NEW: getAiSettings / putAiSettings / deleteAiSettings client
├── lib/permissions.ts            # EDIT: add canManageAiSettings(role) = role === "owner"
└── messages/                     # EDIT: en + ar strings for AI settings surface
```

**Structure Decision**: Web-application monolith. Backend BYOK logic follows the
existing route→service→schema split in a dedicated `ai_settings` module trio; the
only place the raw key is handled server-side is the `services/ai_settings.py`
call into the two `SECURITY DEFINER` RPCs (mirroring how `services/storage.py`
isolates the one place the service-role key touches object bytes). The single new
migration adds the `workspace_ai_settings` metadata table, its RLS policies, the
`set`/`clear` Vault-wrapper functions, and their grants. Frontend AI settings
surfaces live inside the existing `[locale]/w/[workspaceId]/settings` page and
reuse the Phase 5 component/permission/i18n patterns (the AI settings card sits
next to the existing `AutoDeleteToggle` and `AiOptionalNotice`).

## Complexity Tracking

> No constitution violations — this table is intentionally empty.
