# Data Model: Testing, Security Review, and Deployment

This phase introduces **no database entities and no schema changes** — it persists
nothing to Postgres (see plan.md → Storage). The "entities" below are the **artifact
schemas** the phase produces: the structured shape of the findings register, the
security review, the test-coverage matrix, and the deployment inventory. They are the
authoritative definitions the tasks must conform to. Contract files under
`contracts/` hold the living templates.

## E1. Remediation Finding (row in the findings register)

A tracked defect or security weakness discovered by a test or the security review.

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | `F-NNN`, unique, stable, never reused. |
| `title` | string | One-line description. |
| `area` | enum | `financial-accuracy` \| `tenant-isolation` \| `role-permissions` \| `file-privacy` \| `ai-behavior` \| `localization` \| `deployment` \| `other`. |
| `severity` | enum | `Critical` \| `High` \| `Medium` \| `Low` (fixed four-level scale). |
| `source` | string | Failing test id or security-review check id that surfaced it. |
| `reproduction` | string | Minimal steps/inputs to reproduce. |
| `status` | enum | `Open` \| `Triaged` \| `Deferred` \| `Fixed-elsewhere`. Never `Fixed-here` — no product code is changed in this phase. |
| `remediation` | string | Owner and/or target follow-up phase for the fix. |
| `release_blocker` | bool | Derived: `true` iff `severity ∈ {Critical, High}` AND `area ∈ {financial-accuracy, tenant-isolation}`. |

**Lifecycle**: `Open → Triaged → (Deferred | Fixed-elsewhere)`. A finding never
transitions to a "fixed in this phase" state; fixes are scheduled follow-up work.

**Invariant (SC-010)**: at phase completion, **every** discovered issue has a row
here; the set of *untracked* known issues is empty. This is what "no known issues
remain" means for the exit criteria.

## E2. Security Review Check (row in the security review)

A single verifiable assertion under one constitution principle.

| Field | Type | Rules |
|-------|------|-------|
| `check_id` | string | `SR-<principle>-NN`, e.g. `SR-VI-03`. |
| `principle` | enum | `VI-privacy-security` \| `VII-tenant-isolation` \| `IX-architecture-authority` \| `X-financial-accuracy`. |
| `statement` | string | The property being verified (e.g., "BYOK key never returned in any API response"). |
| `verdict` | enum | `PASS` \| `FAIL` \| `N/A`. |
| `evidence` | string | Code path and/or cross-referenced automated test id. |
| `finding_ref` | string? | On `FAIL`, the `F-NNN` id in the findings register. |

**Coverage rule (SC-008)**: 100% of the four in-scope principles have at least the
constitution-mandated checks, and every `FAIL` has a `finding_ref`.

## E3. Coverage Matrix Row (row in the test-coverage matrix)

Maps a required guarantee to the concrete artifact that verifies it.

| Field | Type | Rules |
|-------|------|-------|
| `area` | enum | Same enum as E1 `area` (the constitution testing areas). |
| `requirement` | string | FR/SC id(s) covered (e.g., `FR-004, SC-001`). |
| `verifier` | string | Test file / test id, or `manual-checklist:<item>`. |
| `tier` | enum | `backend-integration` \| `frontend-e2e` \| `frontend-unit` \| `manual`. |
| `status` | enum | `planned` \| `implemented` \| `passing`. |

**Invariant**: every FR-004…FR-021 verification requirement appears in at least one
row; no required guarantee is left with no verifier.

## E4. Deployment Config Item (row in the deployment inventory)

An environment/secret/service input required to run the app in production.

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Exact variable/service name (grounded in `.env.example` + code). |
| `scope` | enum | `backend` \| `frontend` \| `platform` \| `external-service`. |
| `secret` | bool | `true` for service-role key, DB URL, JWT secret; `false` for `NEXT_PUBLIC_*`. |
| `source` | string | Where the value comes from (hosted Supabase project, Bunny secret store, etc.). |
| `notes` | string | e.g. "supplied at deploy time; never committed". |

**Invariant (FR-029, SC-009)**: every variable read by `apps/api` (`os.getenv`) and
`apps/web` (`process.env`) appears here; no `secret: true` value is ever committed to
the repo.

## Verified current config surface (grounds E4)

- Backend: `SUPABASE_URL`, `SUPABASE_DB_URL` (secret), `SUPABASE_SERVICE_ROLE_KEY`
  (secret), `SUPABASE_JWT_SECRET` (secret), `CORS_ALLOW_ORIGINS`, `APP_ENV`.
- Frontend: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (all non-secret).
- External services: Supabase Auth, Postgres, Vault, Storage; Bunny Magic Containers
  (linux/amd64 image via a private GitHub/Docker registry).
