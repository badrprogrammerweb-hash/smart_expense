# Phase 0 Research: Authentication and Workspace Foundation

All Technical Context items in `plan.md` are resolved below. This phase is
the first to provision a real Supabase project, the first real database
schema, and the first FastAPI endpoints beyond the Phase 1 health check — so
most decisions here are genuinely new architecture choices, not just tooling
picks.

## 1. Supabase Auth provider configuration

**Decision**: Enable only the built-in email/password provider in the
Supabase Auth settings for this project. All other providers (OAuth/social,
magic link, phone/SMS) stay disabled at the project-configuration level, not
just unused in application code.

**Rationale**: Spec FR-002 and SC-007 require that no other login entry
point exists at all, not merely that the UI doesn't surface one. Disabling
unused providers at the Supabase project level is the only way to guarantee
SC-007 — an enabled-but-unlinked provider would still be reachable directly
against Supabase's Auth API.

**Alternatives considered**: Leaving all providers enabled and relying on
the (not-yet-built, Phase 5) frontend to only render an email/password form
— rejected because it satisfies the UI but not SC-007's stronger guarantee.

## 2. Where user profile + personal workspace bootstrap happens

**Decision**: A Postgres trigger function (`SECURITY DEFINER`) on
`auth.users AFTER INSERT` creates the user's profile row and a personal
workspace row in a single transaction. FastAPI never performs this bootstrap
itself. The trigger does **not** insert the Owner membership row directly —
inserting the personal workspace row fires the `assign_workspace_owner()`
trigger from Decision 2b below, which creates that Owner membership for any
workspace, personal or team.

**Rationale**: This is the standard, documented Supabase pattern for
post-signup provisioning, and it is the only option that makes FR-003/FR-004
genuinely atomic with account creation — there is no window where an
authenticated user exists without a profile and personal workspace, which
directly satisfies the "interrupted signup" edge case's intent (the gap the
edge case worries about shrinks to "trigger failed," not "FastAPI was never
called"). Guards inside the function (lookups before insert, or
`ON CONFLICT DO NOTHING` against unique constraints) make repeated firing
idempotent, satisfying the "triggered more than once" edge case.

**Alternatives considered**: Having the frontend or FastAPI call a
"complete signup" endpoint after `signUp()` returns — rejected because it
introduces a real gap (network failure between auth success and the
follow-up call) that this phase's edge cases explicitly call out as a
failure mode to prevent, not just handle gracefully.

## 2b. Workspace-creation Owner bootstrap trigger

**Decision**: A second `SECURITY DEFINER` trigger, `assign_workspace_owner()`,
fires `AFTER INSERT` on `workspaces` for every new row — personal or team —
and inserts an Owner membership row for `NEW.created_by`. FastAPI's
`POST /workspaces` (team creation) inserts only the `workspaces` row; this
trigger creates the Owner membership automatically, in the same transaction,
and the signup trigger (Decision 2) relies on it the same way for personal
workspaces.

**Rationale**: The `workspace_memberships` `INSERT` policy (data-model.md)
requires the caller to already hold `owner`/`admin` membership in the
target workspace — which is impossible for a workspace's very first member.
Without a privileged trigger, no caller, including FastAPI, can ever insert
the first Owner row for a newly created team workspace, since they are not
yet a member of it. This trigger is the single mechanism that resolves that
chicken-and-egg problem for both workspace types, and it removes the
duplicate "create the membership row" logic that would otherwise need to
live separately in the signup trigger and in `POST /workspaces` (FR-007,
FR-008).

**Alternatives considered**: Having `POST /workspaces` use the service-role
key to bypass RLS for just the membership insert — rejected, since Decision
4 already commits to keeping the service-role key out of the per-request
hot path; a single, narrowly-scoped trigger is a smaller privileged surface
than handing FastAPI a standing RLS bypass.

## 3. Self-healing repair for a missing personal workspace

**Decision**: In addition to Decision 2, the FastAPI dependency that
resolves "current user" on every authenticated request checks whether the
caller has a personal workspace and Owner membership; if not, it creates
them (same idempotent shape as the trigger) before the request proceeds.

**Rationale**: Resolves the spec's edge case directly: "if a user signs in
but their expected personal workspace is missing... the system must repair
... before the user continues into protected workspace areas." The trigger
(Decision 2) is the primary path and should make this rare in practice, but
the spec treats the repair behavior as a requirement on its own, not merely
a hoped-for side effect of the trigger.

**Alternatives considered**: A scheduled background job that scans for
profiles without a personal workspace — rejected as unnecessary latency and
complexity when the check is a single indexed lookup performed once per
session anyway.

## 4. Tenant isolation enforcement mechanism

**Decision**: Row Level Security is enabled on `user_profiles`,
`workspaces`, and `workspace_memberships`. FastAPI connects to Postgres
directly (not through PostgREST) and, for every authenticated request, runs
the request inside a transaction that sets `request.jwt.claims` and
`role = authenticated` from the verified caller's JWT before issuing any
query — the same session context Supabase's own PostgREST layer would set,
so the identical RLS policies apply whether the row is reached through
FastAPI or any other Supabase-aware client.

**Rationale**: FR-025 requires RLS enforcement "not application checks
only," and constitution Principle IX makes FastAPI the owner of
authorization and calculation logic with Supabase Postgres as the source of
truth. Connecting directly to Postgres (rather than proxying through
PostgREST) keeps that architecture consistent for this phase and for every
later phase that needs real aggregation queries (income/expense totals),
while still getting RLS for free because the session context is identical
to what PostgREST would set.

**Alternatives considered**: Routing all data access through Supabase's
PostgREST API using the user's access token as the bearer token — would
also get RLS for free, but adds a second network hop per request and would
need to be replaced later when financial aggregation queries outgrow
PostgREST's query syntax, so it would be rework rather than a foundation.
Using only the service-role key with hand-written authorization checks in
FastAPI — rejected outright; it satisfies neither FR-025 nor Principle VI
("Frontend checks alone are NEVER sufficient... every protected action MUST
be validated on the backend **or at the database policy level**" implies
the database policy level must be real, not bypassed).

## 5. JWT verification in FastAPI

**Decision**: Verify the Supabase-issued access token using `PyJWT` with
the `cryptography` extra, fetching and caching the project's JWKS
(`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`) and verifying by matching
the token's `kid`. The verified `sub` claim becomes the request's user id;
the full claim set is forwarded into the Postgres session per Decision 4.

**Rationale**: Current Supabase projects issue asymmetric (ES256) JWTs by
default and publish a JWKS endpoint, so JWKS-based verification works
without provisioning or storing any extra shared secret. `PyJWT` is a small,
widely-used dependency already RS/ES-capable with its `cryptography` extra,
avoiding a heavier JWT library.

**Alternatives considered**: Verifying with a shared `SUPABASE_JWT_SECRET`
(HS256) — this remains available for legacy Supabase projects, but
defaulting to it would mean storing and rotating an extra secret that JWKS
verification doesn't need; documented as a fallback only if the
provisioned project turns out to use legacy symmetric signing.

## 6. Postgres connection from FastAPI

**Decision**: Use SQLAlchemy's async engine with the `asyncpg` driver,
pointed at Supabase's direct (session-mode) Postgres connection string,
stored as `SUPABASE_DB_URL`. `SET LOCAL` statements for the JWT claims
(Decision 4) are issued inside the same transaction as the request's actual
query.

**Rationale**: `SET LOCAL` is transaction-scoped, so it is safe even with a
pooled connection, but using the direct/session connection string (rather
than the transaction-mode pooler) for this phase avoids interaction effects
between pooler-level session resets and per-request claim-setting while the
team has not yet load-tested connection volume. SQLAlchemy's async engine
gives later phases (income/expense aggregation) a real query layer instead
of hand-written connection management.

**Alternatives considered**: Raw `asyncpg` without an ORM/query layer —
viable and slightly lighter, but SQLAlchemy's session/transaction
abstractions make the "set claims, then run query, in one transaction"
pattern (Decision 4) easier to enforce consistently across every route
added in this and later phases.

## 7. Role permission matrix for membership management

**Decision**: Role assignment (creating an Owner, or changing anyone's role
to/from Owner) is Owner-only. Admins may add members and assign the
Member/Viewer/Admin roles (not Owner) per FR-009/FR-013/FR-014, and may
change the role of an existing non-owner member between
Member/Viewer/Admin. Admins can never modify an Owner's membership.

**Rationale**: FR-013 grants Owners "assign roles" broadly; FR-014 limits
Admins to "regular workspace details and non-owner members." The clarified
last-Owner-leave flow (FR-017/FR-031) requires *some* path for an Owner to
create a co-Owner before leaving — read together, the only consistent
reading is that creating/assigning the Owner role is reserved for existing
Owners, while Admins operate freely within the non-owner roles.

**Alternatives considered**: Allowing Admins to assign any role including
Owner — rejected because it would let an Admin unilaterally create
additional Owners, which reads against FR-014's "MUST NOT... override
Owners" intent.

## 8. Team workspace member cap and personal workspace exclusivity

**Decision**: Enforce both as database constraints, not just application
checks: a `BEFORE INSERT` trigger on `workspace_memberships` rejects a new
row for a `team`-type workspace once it already has 10 members (FR-030),
and unconditionally rejects any membership insert for a `personal`-type
workspace other than its original Owner row (spec Assumptions: a personal
workspace is single-user by nature).

**Rationale**: Matches Decision 4's principle that isolation/permission
rules live at the database level, not only in FastAPI — a direct psql
session or a future service should not be able to violate these invariants
by skipping the API layer.

**Alternatives considered**: Checking the cap only in the FastAPI route
handler before calling insert — rejected as a single-layer check that
contradicts the "not application checks only" posture already established
for isolation (FR-025) and applied here for consistency.

## 9. Local development and RLS testing

**Decision**: Use the Supabase CLI (`supabase start`) to run a local
Postgres + Auth stack for development and automated tests. Migrations and
RLS policies live as versioned SQL files under `supabase/migrations/`,
applied via `supabase db reset` / `supabase migration up`. Backend tests use
`pytest` + `pytest-asyncio` + `httpx` (ASGI transport) for route-level tests,
plus integration tests that sign in as multiple real local-Auth test users
to exercise RLS exactly as production would.

**Rationale**: RLS policies cannot be meaningfully verified against a mock
— constitution Principle XIV requires tenant isolation to be tested, and
SC-004/SC-005 require verified allow/deny outcomes per role and per
cross-workspace attempt. The Supabase CLI is the only practical way to get
a real `auth.users` table, real JWT issuance, and real RLS evaluation in
CI/local dev without a shared hosted project per contributor.

**Alternatives considered**: Mocking the database layer in tests — rejected
because it cannot exercise RLS at all, and this phase's success criteria are
specifically about verified access-control outcomes. Testing only against a
shared hosted staging project — rejected as slower, harder to reset between
test runs, and a shared mutable resource across contributors/CI runs.

## Outcome

All Technical Context fields in `plan.md` are resolved; no
`NEEDS CLARIFICATION` markers remain. Decisions 2–3 and 8 directly implement
the four clarifications recorded in `spec.md`'s Clarifications section
(no deletion/archival this phase, 10-member cap, voluntary leave with
last-Owner guard, duplicate-add rejection). Decision 2b closes a gap found
during `/speckit-analyze`: without it, the `workspace_memberships` RLS
`INSERT` policy in Decision 7/`data-model.md` would have no valid path to
create a team workspace's first Owner row.
