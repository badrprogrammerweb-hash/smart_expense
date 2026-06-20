# Phase 1 Data Model: Foundation and Repository Setup

This feature introduces no database schema, no migrations, and no persisted
business records — Supabase Postgres schema ownership begins in Phase 2
(Auth and Workspace Foundation), per the implementation plan. The two
conceptual entities below (from the spec's Key Entities section) are
structural/documentation concepts, not database tables.

## Repository Boundary

Represents one top-level domain of the monolith. Not a runtime data
structure — a directory-level convention validated by the acceptance
scenarios in `spec.md` (User Story 1).

| Attribute | Description |
|---|---|
| `name` | Top-level directory name (`apps/web`, `apps/api`, `packages/shared`, `supabase`, `specs`, `docs`, `infra`, `tests`) |
| `purpose` | The single domain it owns (frontend code, backend code, shared cross-cutting code, database artifacts, specs/plans/tasks, practical docs, deployment config, test strategy docs) |
| `owner_phase` | Which implementation phase is authoritative for that boundary's contents going forward (e.g., `apps/api` business logic starts Phase 2; `supabase` migrations start Phase 2; `infra` real deployment config starts Phase 10) |

**Validation rule** (from FR-001–FR-009): exactly one boundary owns each
purpose; no two boundaries may claim the same purpose; no boundary may
represent a separately deployable/versioned repository.

**State transitions**: none — boundaries are established once in this phase
and do not change state; they only gain content over subsequent phases.

## Environment Setup Documentation

Represents the practical reference enumerated by FR-012–FR-014. Modeled here
as a structured concept (not a database row) to make its required fields
explicit for the documentation that `docs/setup.md` must contain.

| Attribute | Description |
|---|---|
| `variable_name` | The exact environment variable name an app reads |
| `owning_app` | Which app consumes it (`apps/web` or `apps/api`) |
| `purpose` | One-sentence explanation of what it configures |
| `committed_or_secret` | Whether a real value is safe to commit (always "secret — local only" in this phase, since no variable in Phase 1 holds non-sensitive data worth committing) |
| `required_for_startup` | Whether the app fails, runs in a degraded/"not configured" mode, or is unaffected when this variable is absent (per FR-014, FR-017) |

**Validation rule** (from FR-012, SC-003): every variable referenced by
either app's startup code must have a corresponding documented row before
this feature is complete.

**State transitions**: none.

## Out of scope for this phase

No `Income`, `Expense`, `Workspace`, `User`, `Category`, `File`, or any other
business entity from the master implementation plan's data model section is
created, migrated, or referenced here. Those begin with Phase 2 onward.
