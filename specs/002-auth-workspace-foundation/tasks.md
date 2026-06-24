---

description: "Task list for Authentication and Workspace Foundation (002-auth-workspace-foundation)"
---

# Tasks: Authentication and Workspace Foundation

**Input**: Design documents from `/specs/002-auth-workspace-foundation/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. Constitution Principle XIV requires authentication, workspace access, role permissions, and tenant isolation to be tested, and spec.md's SC-004/SC-005 require "100% verified" allow/deny outcomes — `research.md` Decision 9 already commits to `pytest` + a real local Supabase stack (not mocks) for exactly this reason. This is also the first phase with real business logic, per the deferral noted in `specs/001-foundation/tasks.md`.

**Organization**: Tasks are grouped by user story (US1, US2, US3, US4 from `spec.md`) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths are included in each description

## Path Conventions

Monolith web application layout per `plan.md`: this feature's changes are
confined to `apps/api` (backend) and `supabase` (database); `apps/web` is
untouched (Phase 5 builds its UI).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tooling and dependencies needed before any schema or story-specific work

- [X] T001 [P] Initialize the Supabase CLI project config by running `supabase init` at the repository root, producing `supabase/config.toml` and the `supabase/migrations/` directory, without altering the existing `supabase/README.md`
- [X] T002 [P] Add `PyJWT[crypto]`, `SQLAlchemy`, `asyncpg`, `pytest`, `pytest-asyncio`, and `httpx` to `apps/api/requirements.txt` (research.md Decisions 5, 6, 9)
- [X] T003 [P] Add `SUPABASE_DB_URL` (direct Postgres connection string) and `SUPABASE_JWT_SECRET` (legacy HS256 fallback, optional) entries to `apps/api/.env.example`, alongside the existing `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` entries, with inline comments stating purpose and secret status (research.md Decisions 5, 6)
- [X] T003a [P] Configure `supabase/config.toml` to enable only the email/password Auth provider — `[auth.email] enable_signup = true`, and `enabled = false` for every `[auth.external.*]` provider block (google, github, etc.) — with a matching note for the equivalent hosted-project Auth settings used in staging/production (research.md Decision 1; FR-002, SC-007)
- [X] T003b [P] Add `apps/api/tests/test_auth_providers_disabled.py` (or equivalent) that parses `supabase/config.toml` and asserts `[auth.email] enable_signup = true` while every `[auth.external.*]` provider block is `enabled = false`, so a future config edit cannot silently reopen a non-email login path without failing CI (depends on T003a; FR-002, SC-007)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, RLS, triggers, and the auth/DB layer that every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create `supabase/migrations/20260624000000_auth_workspace_foundation.sql` defining the `user_profiles`, `workspaces`, and `workspace_memberships` tables with the column types, `CHECK` constraints, and `UNIQUE (workspace_id, user_id)` constraint from `data-model.md` (FR-003, FR-004, FR-010, FR-011)
- [X] T005 Append `ENABLE ROW LEVEL SECURITY` and the `SELECT`/`INSERT`/`UPDATE` policies for `user_profiles`, `workspaces`, and `workspace_memberships` to `supabase/migrations/20260624000000_auth_workspace_foundation.sql`, including the email-lookup `SECURITY DEFINER` function described in `data-model.md`'s `user_profiles` section (depends on T004; FR-018, FR-019, FR-020, FR-024, FR-025)
- [X] T006 Append the `SECURITY DEFINER` `handle_new_user()` function and its `AFTER INSERT` trigger on `auth.users` to `supabase/migrations/20260624000000_auth_workspace_foundation.sql`, creating a profile and a personal workspace idempotently in one transaction; the Owner membership is created by the `assign_workspace_owner()` trigger from T006a, fired automatically by this insert (depends on T004; research.md Decision 2; FR-003, FR-004, FR-005)
- [X] T006a Append the `SECURITY DEFINER` `assign_workspace_owner()` function and its `AFTER INSERT` trigger on `workspaces` to `supabase/migrations/20260624000000_auth_workspace_foundation.sql`, inserting an Owner membership row for `NEW.created_by` on every new workspace row — personal (from T006) or team (from T027) (depends on T004; research.md Decision 2b; FR-007, FR-008; resolves the RLS chicken-and-egg gap that would otherwise block team-workspace creation)
- [X] T007 Append the `BEFORE INSERT` trigger enforcing the 10-member team cap and personal-workspace single-membership rule, and the `BEFORE DELETE` / `BEFORE UPDATE OF role` trigger enforcing last-Owner protection, to `supabase/migrations/20260624000000_auth_workspace_foundation.sql` (depends on T004; research.md Decision 8; FR-017, FR-029, FR-030)
- [X] T008 [P] Implement `apps/api/app/core/config.py` reading `SUPABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_JWT_SECRET` from the environment
- [X] T009 [P] Implement `apps/api/app/schemas/workspaces.py` with Pydantic models for `Workspace`, `WorkspaceMember`, `WorkspaceCreateRequest`, `MemberAddRequest`, and `MemberRoleUpdateRequest`, matching the fields in `data-model.md` and the request/response shapes in `contracts/workspaces-api.md` and `contracts/workspace-members-api.md`
- [X] T010 Implement `apps/api/app/core/auth.py`: JWKS fetch/cache against `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`, JWT signature/expiry verification via `PyJWT`, and a `get_current_user` FastAPI dependency that extracts the verified `sub` claim and returns `401` per `contracts/session-validation.md` on failure (depends on T008; research.md Decision 5)
- [X] T011 [P] Implement `apps/api/app/db.py`: a SQLAlchemy async engine/session factory against `SUPABASE_DB_URL`, with a per-request helper that issues `SET LOCAL request.jwt.claims` and `SET LOCAL role authenticated` from the verified token before any query runs in that transaction (depends on T010; research.md Decisions 4, 6)
- [X] T012 [P] Implement shared JSON error-response exception handlers in `apps/api/app/main.py` for `401`/`403`/`404`/`409`/`422`, matching the envelope in `contracts/session-validation.md` (depends on T010)
- [X] T012a [P] Configure logging in `apps/api/app/main.py` (or a dedicated `app/core/logging.py`) so request/exception logs never record the raw `Authorization` header, JWT contents, or full email addresses — a redaction filter or structured-logging processor applied before any log sink (constitution Principle VI; depends on T010)
- [X] T013 [P] Create `apps/api/tests/conftest.py` with an `httpx` ASGI test client fixture and a helper that signs up a real user against the local Supabase Auth REST API (`POST {SUPABASE_URL}/auth/v1/signup`) and returns their access token, for reuse by every story's tests (research.md Decision 9)

**Checkpoint**: Foundation ready — schema, RLS, triggers, JWT verification, and DB session layer all exist; user story implementation can now begin

---

## Phase 3: User Story 1 - Sign up and enter a personal workspace (Priority: P1) 🎯 MVP

**Goal**: A new user signs up, signs in, and immediately has a profile, exactly one personal workspace, and Owner membership in it — no team setup required (SC-001, SC-002).

**Independent Test**: Register a new account, sign in, and call `GET /workspaces`; confirm exactly one `type: "personal"` workspace with `role: "owner"` (`quickstart.md` steps 1-3).

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T014 [P] [US1] Integration test in `apps/api/tests/test_signup_bootstrap.py`: a freshly signed-up user has exactly one profile, one personal workspace, and one Owner membership; firing the bootstrap logic twice for the same account stays idempotent (FR-003, FR-004, FR-005, and the "triggered more than once" edge case)
- [X] T015 [P] [US1] Contract test in `apps/api/tests/test_workspaces_list.py`: `GET /workspaces` without a token returns `401`; with a valid token it returns exactly one `type: "personal"` workspace with `role: "owner"` (`contracts/workspaces-api.md`, `contracts/session-validation.md`)

### Implementation for User Story 1

- [X] T016 [US1] Implement `GET /workspaces` and `GET /workspaces/{workspace_id}` in `apps/api/app/routes/workspaces.py` per `contracts/workspaces-api.md` (depends on T009, T010, T011)
- [X] T017 [US1] Register the workspaces router in `apps/api/app/main.py` (depends on T016)
- [X] T018 [P] [US1] Add the self-healing personal-workspace repair check to the `get_current_user` dependency in `apps/api/app/core/auth.py`: if the caller has no personal workspace, create one idempotently before the request proceeds (depends on T010; research.md Decision 3; "interrupted signup" edge case)
- [X] T019 [US1] Validate User Story 1 per `quickstart.md` steps 1-3: sign up, and confirm exactly one personal workspace with Owner role appears in `GET /workspaces` within 2 minutes (depends on T014-T018; SC-001, SC-002)

**Checkpoint**: User Story 1 fully functional and testable independently

---

## Phase 4: User Story 4 - Preserve tenant isolation across workspaces (Priority: P1)

**Goal**: A user can only see workspaces and member lists for workspaces where they are a member, even when they know another workspace's id (acceptance scenarios 1-2, using each user's own personal workspace from US1 — no team workspace needed yet).

**Independent Test**: With two signed-up users from US1, confirm one user's `GET /workspaces/{id}` and `GET /workspaces/{id}/members` against the other user's personal workspace both return `404` (`quickstart.md` step 6). Acceptance scenario 3 (a *removed* team member losing access) is regression-checked in **T031** (Phase 6) once User Story 3 adds removal — it cannot be demonstrated until that capability exists.

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T020 [P] [US4] Integration test in `apps/api/tests/test_workspace_isolation.py`: User B requesting User A's personal workspace via `GET /workspaces/{id}` receives `404`, identical in shape to a request against a nonexistent id (FR-019, FR-024, SC-005)
- [X] T021 [P] [US4] Integration test in `apps/api/tests/test_workspace_members_list.py`: `GET /workspaces/{workspace_id}/members` succeeds for any current member regardless of role, and returns `404` for a non-member (FR-020)

### Implementation for User Story 4

- [X] T022 [US4] Implement `GET /workspaces/{workspace_id}/members` in `apps/api/app/routes/workspace_members.py` per `contracts/workspace-members-api.md` (depends on T009, T010, T011)
- [X] T023 [US4] Register the workspace_members router in `apps/api/app/main.py` (depends on T022, T017)
- [X] T024 [US4] Validate User Story 4 per `quickstart.md` step 6: confirm cross-user requests against both the workspace-detail and member-list endpoints return `404` (depends on T020-T023; SC-005, SC-006)

**Checkpoint**: User Stories 1 AND 4 both work independently

---

## Phase 5: User Story 2 - Create and access a minimal team workspace (Priority: P2)

**Goal**: A signed-in user creates a team workspace and adds an existing user with a fixed role; both members see the workspace, non-members do not (SC-003, SC-006).

**Independent Test**: One signed-in user creates a team workspace, adds a second existing user as a member, and both see it via `GET /workspaces` while a third, unrelated user does not (`quickstart.md` step 4).

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T025 [P] [US2] Contract test in `apps/api/tests/test_workspaces_create.py`: `POST /workspaces` creates a `type: "team"` workspace and makes the caller its Owner in the same response (FR-007, FR-008)
- [X] T026 [P] [US2] Contract test in `apps/api/tests/test_workspace_members_add.py`: `POST /workspaces/{id}/members` succeeds for an Owner/Admin caller adding a non-owner role, and returns `403` for a Member/Viewer caller, `404` for an unknown email, `409` for a duplicate member (role left unchanged), `409` once the workspace already has 10 members, and `422` for `role: "owner"`; additionally assert that an unrelated third user's `GET /workspaces` does not include this workspace (FR-009, FR-010, FR-011, FR-013, FR-014, FR-018, FR-030, FR-032, SC-006)

### Implementation for User Story 2

- [X] T027 [P] [US2] Implement `POST /workspaces` in `apps/api/app/routes/workspaces.py` per `contracts/workspaces-api.md`; the Owner membership row is created automatically by the `assign_workspace_owner()` trigger (T006a), not by this route (depends on T016, T006a)
- [X] T028 [P] [US2] Implement `POST /workspaces/{workspace_id}/members` in `apps/api/app/routes/workspace_members.py` per `contracts/workspace-members-api.md`, including the non-owner role restriction, duplicate-member, unknown-email, and 10-member-cap error handling (depends on T022)
- [X] T029 [US2] Validate User Story 2 per `quickstart.md` step 4: create a team workspace and add an existing user with a role in under 3 minutes (depends on T025-T028; SC-003)

**Checkpoint**: User Stories 1, 4, AND 2 all work independently

---

## Phase 6: User Story 3 - Enforce fixed workspace roles (Priority: P2)

**Goal**: Owner, Admin, Member, and Viewer each have exactly the allowed/denied actions for member management, including last-Owner protection and voluntary leave (SC-004, SC-008).

**Independent Test**: Assign each fixed role to test users in a team workspace and verify the allowed/denied outcome for role changes, removal, and voluntary leave, including the last-Owner guard (`quickstart.md` step 5, 8).

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T030 [P] [US3] Contract test in `apps/api/tests/test_workspace_members_role.py`: `PATCH /workspaces/{id}/members/{user_id}` — Owner caller may set any role including promoting to `owner`; Admin caller may set `admin`/`member`/`viewer` only when the target's current role is not `owner`, and is `403` otherwise; Member/Viewer caller is always `403`; an out-of-set role is `422` (FR-011, FR-012, FR-013, FR-014, FR-015, FR-016; research.md Decision 7)
- [X] T031 [P] [US3] Contract test in `apps/api/tests/test_workspace_members_remove.py`: `DELETE /workspaces/{id}/members/{user_id}` follows the same caller-role matrix as T030, returns `409 last_owner_protected` when targeting the sole remaining Owner, and — using the removed user's own token — confirms their next `GET /workspaces/{workspace_id}` returns `404` (FR-013, FR-014, FR-017; closes User Story 4 acceptance scenario 3 / SC-008 for the removed-by-admin path)
- [X] T032 [P] [US3] Contract test in `apps/api/tests/test_workspace_members_leave.py`: `DELETE /workspaces/{id}/members/me` lets any non-sole-owner member leave voluntarily (`204`), returns `409 last_owner_protected` for the sole remaining Owner, and `403` when the target workspace is `type: "personal"` (FR-031)

### Implementation for User Story 3

- [X] T033 [US3] Implement `PATCH /workspaces/{workspace_id}/members/{user_id}` in `apps/api/app/routes/workspace_members.py` per `contracts/workspace-members-api.md` and research.md Decision 7's role matrix (depends on T028)
- [X] T034 [US3] Implement `DELETE /workspaces/{workspace_id}/members/{user_id}` in `apps/api/app/routes/workspace_members.py` per `contracts/workspace-members-api.md`, including the last-Owner-protected error (depends on T033)
- [X] T035 [US3] Implement `DELETE /workspaces/{workspace_id}/members/me` in `apps/api/app/routes/workspace_members.py` per `contracts/workspace-members-api.md`: check `workspace.type == 'personal'` first and return `403 forbidden` before attempting the delete, so this case is distinguished from the generic `409 last_owner_protected` the last-Owner trigger would otherwise raise for the same row (depends on T034)
- [X] T036 [US3] Validate User Story 3 per `quickstart.md` steps 5 and 8: the role-permission matrix produces the expected allow/deny outcome for all four roles, and the last-Owner-leave flow (promote a co-Owner, then leave) succeeds while leaving immediately as sole Owner does not (depends on T030-T035; SC-004, SC-008)

**Checkpoint**: All four user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final validation across all user stories

- [X] T037 [P] Update `supabase/README.md` to describe the live schema (`user_profiles`, `workspaces`, `workspace_memberships`), its RLS policies, and its triggers, replacing the Phase 1 placeholder text
- [X] T038 [P] Update `docs/setup.md`: add the Supabase CLI prerequisite and `supabase start` step, document the new `apps/api/.env` values (`SUPABASE_DB_URL`, `SUPABASE_JWT_SECRET`), and how to run the backend test suite (`pytest`)
- [X] T039 [P] Confirm `.gitignore` excludes Supabase CLI local-stack artifacts (e.g. `supabase/.temp`, `supabase/.branches`) and actively scan the working tree (`git status`, `git diff --staged`) for any committed real secret value (constitution Principle VI)
- [X] T040 Run the full `quickstart.md` (steps 1-9) end-to-end against a fresh local Supabase stack as final cross-story validation
- [X] T041 Update `specs/002-auth-workspace-foundation/spec.md` Status field from `Draft` to `Implemented` once T001-T040 are verified complete (closes out FR-001–FR-032, SC-001–SC-008)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 and US4 are both P1 — implement in this order (US1 then US4) since US4's isolation tests reuse US1's personal workspaces
  - US2 and US3 are both P2 — implement in this order (US2 then US3) since US3's role/removal/leave actions operate on members US2's add-member endpoint creates
- **Polish (Phase 7)**: Depends on all four user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on other stories
- **User Story 4 (P1)**: Can start after Foundational; its tests reuse US1's `GET /workspaces/{id}` pattern and personal workspaces, so implement after US1 even though both are P1
- **User Story 2 (P2)**: Can start after Foundational; independently testable, does not require US4
- **User Story 3 (P2)**: Can start after Foundational, but its role/removal/leave endpoints operate on team memberships that only exist once US2's add-member endpoint works — implement after US2

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Schemas/config before routes
- Routes before router registration
- Story complete before moving to the next priority

### Parallel Opportunities

- T001-T003b (Setup, five different files) can run in parallel
- T008, T009, T011, T012, T012a, T013 (Foundational, six different files) can run in parallel once T004-T007 plus T006a (the single migration file's sequential sections, including the Decision 2b trigger) and T010 (which T011/T012/T012a depend on) are done
- T014, T015 (US1 tests) can run in parallel; T018 can run in parallel with T016/T017
- T020, T021 (US4 tests) can run in parallel
- T025, T026 (US2 tests) can run in parallel; T027, T028 (different files) can run in parallel
- T030, T031, T032 (US3 tests, three different files) can run in parallel
- T037, T038, T039 (Polish, three different files) can run in parallel

---

## Parallel Example: User Story 2

```bash
# Launch both User Story 2 contract tests together:
Task: "Contract test for POST /workspaces in apps/api/tests/test_workspaces_create.py"
Task: "Contract test for POST /workspaces/{id}/members in apps/api/tests/test_workspace_members_add.py"

# Launch both User Story 2 implementation tasks together (different files):
Task: "Implement POST /workspaces in apps/api/app/routes/workspaces.py"
Task: "Implement POST /workspaces/{workspace_id}/members in apps/api/app/routes/workspace_members.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: a new user reaches their personal workspace — this alone proves the signup-bootstrap trigger and RLS work end-to-end

### Incremental Delivery

1. Complete Setup + Foundational → schema, RLS, triggers, auth/DB layer ready
2. Add User Story 1 → validate independently → signup-to-personal-workspace proven
3. Add User Story 4 → validate independently → cross-tenant denial proven
4. Add User Story 2 → validate independently → team workspace creation + add-member proven
5. Add User Story 3 → validate independently → full role matrix, last-Owner guard, and voluntary leave proven
6. Polish → docs updated, secrets scan, full quickstart re-run

### Parallel Team Strategy

With multiple contributors:

1. Complete Setup + Foundational together (single contributor recommended, given the shared migration file)
2. Once Foundational is done:
   - Contributor A: User Story 1, then User Story 4 (shares `workspaces.py`/personal-workspace context)
   - Contributor B: User Story 2, then User Story 3 (shares `workspace_members.py` context)
3. Stories complete and validate independently; Polish phase runs last

---

## Notes

- [P] tasks touch different files and have no unmet dependencies
- [Story] label maps each task to its user story for traceability
- Tests use a real local Supabase stack (Supabase CLI), not mocks — RLS cannot be meaningfully verified otherwise (research.md Decision 9)
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before continuing
