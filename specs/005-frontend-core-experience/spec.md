# Feature Specification: Frontend Core Experience

**Feature Branch**: `005-frontend-core-experience`

**Created**: 2026-07-01

**Status**: Implemented

**Input**: User description: "Phase 5 — Frontend Core Experience, based on docs/implementation-plan.md section 17. Create the specification for Phase 5 ONLY (build authentication UI, workspace selector, dashboard, income forms, expense forms, category UI, reports UI, settings UI, Arabic/English readiness, RTL readiness). Do not include Phase 6+ scope (file upload, BYOK/AI, extraction, advanced reports/history). This follows Phase 4 (backend financial dashboard, already complete on main) which provides the GET /workspaces/{workspace_id}/dashboard endpoint and contract at specs/004-backend-financial-dashboard/contracts/dashboard-api.md."

## Clarifications

### Session 2026-07-01

- Q: Does Phase 5 include a dedicated income/expense history list beyond the dashboard's "recent records" preview? → A: Yes — a full, browsable income & expense history screen is in scope this phase, so any confirmed record (not just recent ones) can be found and edited or deleted.
- Q: Which workspace does a returning user with more than one workspace land on after sign-in? → A: Their most recently active workspace, persisted client-side across sessions (not always the personal workspace).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in and see the financial picture at a glance (Priority: P1)

A user signs in and lands on their workspace dashboard, immediately seeing
their remaining balance, total income, total expenses, and current period —
the single most important thing the product exists to show.

**Why this priority**: Without a working sign-in flow and a dashboard that
renders the backend's financial summary, none of the rest of the product is
reachable. This is the entry point every other user story depends on.

**Independent Test**: Can be fully tested by registering a new account,
signing in, and confirming the dashboard for the default personal workspace
renders remaining balance, total income, total expenses, and the current
period without errors.

**Acceptance Scenarios**:

1. **Given** a new visitor, **When** they register with an email and
   password, **Then** an account is created and they land on their personal
   workspace dashboard.
2. **Given** a registered user, **When** they sign in with correct
   credentials, **Then** they reach their most recently used workspace's
   dashboard.
3. **Given** a signed-in user, **When** their workspace has confirmed income
   and expense records, **Then** the dashboard shows the correct remaining
   balance, total income, total expenses, and current period, matching the
   backend calculation.
4. **Given** a signed-in user, **When** their workspace has no records yet,
   **Then** the dashboard shows a clear empty state instead of blank space
   or an error.
5. **Given** an unauthenticated visitor, **When** they try to open any
   workspace page directly, **Then** they are redirected to sign in.
6. **Given** a signed-in user, **When** they sign out, **Then** their
   session ends and they are returned to the sign-in screen.

---

### User Story 2 - Record income and expenses manually (Priority: P1)

An authorized workspace member adds, edits, and deletes income and expense
records through forms, and sees the dashboard totals update to match,
without needing any AI feature.

**Why this priority**: Manual income and expense entry is the core
day-to-day action the product is built around. It is the first thing a user
does after seeing an empty dashboard, and it is independently valuable and
testable on its own.

**Independent Test**: Can be fully tested by adding an income record and an
expense record through their respective forms, confirming both appear in
recent activity and are reflected in the dashboard totals, then editing and
deleting one of them and confirming totals update accordingly.

**Acceptance Scenarios**:

1. **Given** an Owner or Admin, **When** they submit the add-income form
   with a positive amount and a date, **Then** the record is saved and the
   dashboard's total income and remaining balance update.
2. **Given** an authorized workspace member, **When** they submit the
   add-expense form with a positive amount, a date, and an optional
   category, **Then** the record is saved and the dashboard's total
   expenses and remaining balance update.
3. **Given** an authorized user viewing an existing record, **When** they
   edit its amount, date, description, or category and save, **Then** the
   change is persisted and totals reflect the new value.
4. **Given** an authorized user, **When** they choose to delete a record,
   **Then** the UI asks for confirmation before the record is removed from
   totals (deletion cannot be undone from the UI).
5. **Given** a Member without income-creation rights or a Viewer, **When**
   they open the app, **Then** the add-income action is not available to
   them, and any action they are not permitted to perform is hidden or
   disabled rather than failing silently after submission.
6. **Given** a form submission with a missing or non-positive amount or a
   missing date, **When** the user tries to submit, **Then** the form shows
   an inline validation error and does not submit.
7. **Given** an authorized user, **When** they open the income/expense
   history list, **Then** they can find and open any confirmed record for
   the workspace — not only the handful shown as "recent" on the
   dashboard — in order to edit or delete it.

---

### User Story 3 - Organize expenses with categories (Priority: P2)

An Owner or Admin views the default Saudi-first categories, creates custom
categories, renames them, and archives ones no longer needed, so expenses
stay organized without affecting the core remaining-balance model.

**Why this priority**: Categorization improves clarity but is secondary to
recording transactions and seeing accurate totals, which User Stories 1 and
2 already deliver.

**Independent Test**: Can be fully tested by opening the category screen,
confirming the default categories are listed, creating a custom category,
renaming it, and archiving it, then confirming an archived category no
longer appears as a selectable option on the expense form.

**Acceptance Scenarios**:

1. **Given** a newly created workspace, **When** a member opens the
   category screen, **Then** the default Saudi-first category set is
   already listed with no setup step required.
2. **Given** an Owner or Admin, **When** they create a custom category with
   a name, **Then** it appears in the category list and is selectable on
   the expense form.
3. **Given** an Owner or Admin, **When** they rename or archive a category,
   **Then** the change is reflected immediately in the category list.
4. **Given** an archived category, **When** a member opens the expense
   form's category picker, **Then** the archived category is not offered
   as a choice, though existing expenses that reference it still display
   its name.
5. **Given** a Member or Viewer, **When** they open the category screen,
   **Then** create, rename, and archive actions are not available to them.

---

### User Story 4 - Work across a personal and a team workspace (Priority: P2)

A user who belongs to more than one workspace switches between their
personal workspace and a team workspace, and can create a new team
workspace, with each workspace showing its own independent financial data.

**Why this priority**: Multi-workspace support is core to the product's
target users (families, couples, small teams), but a single user can fully
experience and validate Stories 1-3 inside just their personal workspace
first, which is why this is ranked after them.

**Independent Test**: Can be fully tested by creating a team workspace from
the workspace selector, switching into it, confirming its dashboard shows
independent (empty) totals, adding a record there, and confirming it does
not appear in the personal workspace's totals.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they open the workspace selector,
   **Then** they see every workspace they belong to, labeled as personal
   or team.
2. **Given** a signed-in user, **When** they select a different workspace
   from the list, **Then** the dashboard and all record lists reload to
   show that workspace's own data.
3. **Given** a signed-in user, **When** they create a new team workspace
   with a name, **Then** it appears in their workspace list and they
   become its Owner.
4. **Given** a user viewing one workspace, **When** they check another
   workspace's totals, **Then** the two workspaces' figures never mix.

---

### User Story 5 - Review current-period reports (Priority: P3)

A workspace member opens a reports view to see the current period's income
versus expenses and a category breakdown, without needing to interpret the
raw dashboard numbers themselves.

**Why this priority**: A dedicated reports view is a convenience layer over
data already visible on the dashboard (Story 1); it adds clarity but no new
capability, so it is the lowest priority in this phase.

**Independent Test**: Can be fully tested by opening the reports screen and
confirming the income-vs-expense figures and category breakdown match the
dashboard's numbers for the same workspace and period.

**Acceptance Scenarios**:

1. **Given** a workspace with confirmed records in the current period,
   **When** a member opens the reports screen, **Then** it shows total
   income, total expenses, and a category breakdown for the current period
   that match the dashboard.
2. **Given** a workspace with no confirmed records yet, **When** a member
   opens the reports screen, **Then** it shows a clear empty state.
3. **Given** a Viewer, **When** they open the reports screen, **Then** they
   can view it but cannot trigger any data-modifying action from it.

---

### User Story 6 - Set language and personal preferences (Priority: P3)

A user opens settings, switches the interface language between Arabic and
English, and sees the entire app immediately re-render in the correct
reading direction.

**Why this priority**: Language and layout preference is important to the
product's Saudi-first positioning but does not block a user from completing
the core income/expense workflow in the default language, so it ranks
below the transactional stories.

**Independent Test**: Can be fully tested by opening settings, switching the
language, and confirming labels switch language and the layout mirrors to
right-to-left (or back to left-to-right) across the dashboard, forms, and
navigation without a page reload leaving stale text.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they open settings, **Then** they
   see their current language preference and basic profile/workspace
   information.
2. **Given** a signed-in user, **When** they switch the language to
   Arabic, **Then** interface text switches to Arabic and the layout
   mirrors to a right-to-left reading direction.
3. **Given** a signed-in user, **When** they switch the language back to
   English, **Then** interface text and layout return to a left-to-right,
   English presentation.
4. **Given** a user with no AI key configured, **When** they look for
   AI-related settings, **Then** the UI clearly indicates AI features are
   optional and not yet configured, without presenting a broken or
   incomplete AI settings screen.

---

### Edge Cases

- What happens when the backend session expires while a user is mid-way
  through filling out an income or expense form? The UI must preserve the
  entered values where possible and prompt re-authentication rather than
  silently discarding the form.
- What happens when a user's role changes (e.g., demoted from Admin to
  Viewer) while they have a workspace open in another tab? The next action
  they attempt must be re-checked against their current permissions rather
  than trusting a stale client-side role.
- How does the UI behave if the dashboard, income, expense, or category
  request fails (network error or backend error)? The screen must show a
  clear retry option rather than a blank screen or a silent failure.
- What happens when a workspace has confirmed expenses that exceed
  confirmed income? The dashboard and reports view must display the
  resulting negative remaining balance clearly rather than clamping it to
  zero or hiding it.
- What happens when a user with only one workspace (their personal
  workspace) opens the workspace selector? It must still function, showing
  a list of one, without implying a team workspace is required.
- What happens when a user submits a form twice quickly (double-click)?
  The UI must prevent a duplicate record from being created.
- What happens when an expense references a category that is later
  archived? The expense keeps showing that category's name for historical
  clarity even though the category is no longer selectable for new
  expenses.

## Requirements *(mandatory)*

### Functional Requirements

**Authentication**

- **FR-001**: The system MUST let a new visitor register an account with an
  email and password.
- **FR-002**: The system MUST let a registered user sign in with their
  credentials and reach a workspace dashboard.
- **FR-003**: The system MUST let a signed-in user sign out, ending their
  session and returning them to the sign-in screen.
- **FR-004**: The system MUST let a user request a password reset if they
  cannot sign in.
- **FR-005**: The system MUST redirect unauthenticated visitors away from
  any workspace page to the sign-in screen.

**Workspace selection**

- **FR-006**: The system MUST show every workspace the signed-in user
  belongs to, labeled as personal or team.
- **FR-007**: The system MUST let a user switch their active workspace and
  reload workspace-scoped data (dashboard, records, categories, reports)
  for the newly selected workspace.
- **FR-008**: The system MUST let an authorized user create a new team
  workspace by providing a name.
- **FR-009**: The system MUST land a signed-in user on their most recently
  active workspace's dashboard after sign-in, persisted client-side across
  sessions; a user with no prior activity lands on their personal
  workspace (Clarification, Session 2026-07-01).

**Dashboard**

- **FR-010**: The system MUST display, for the active workspace's current
  period, total confirmed income, total confirmed expenses, and remaining
  balance, sourced from the backend financial summary.
- **FR-011**: The system MUST display a category breakdown of confirmed
  expenses for the current period.
- **FR-012**: The system MUST display a list of the most recent confirmed
  income and expense records.
- **FR-013**: The system MUST display the count of items pending AI review,
  and MUST NOT imply AI review is available when the workspace has no AI
  key configured.
- **FR-014**: The system MUST provide quick actions from the dashboard to
  add income and add an expense.
- **FR-015**: The system MUST show a clear empty state on the dashboard
  when the workspace has no confirmed income or expense records yet.

**Income and expense forms**

- **FR-016**: The system MUST provide a form to create an income record
  with amount, date, and an optional description, and MUST only expose the
  action to users authorized to create income.
- **FR-017**: The system MUST provide a form to create an expense record
  with amount, date, an optional description, an optional merchant name,
  and an optional category.
- **FR-018**: The system MUST let an authorized user edit an existing
  income or expense record's fields and immediately reflect the change in
  displayed totals.
- **FR-019**: The system MUST let an authorized user delete an existing
  income or expense record only after an explicit confirmation step, and
  MUST immediately exclude it from displayed totals afterward.
- **FR-020**: The system MUST validate income and expense forms client-side
  (positive amount, valid date) and show inline errors before submission,
  while still relying on the backend as the final authority on
  acceptance.
- **FR-021**: The system MUST hide or disable record-creation, edit, and
  delete actions for users not authorized to perform them, based on their
  current role in the active workspace.

**Income and expense history**

- **FR-022**: The system MUST provide a browsable income and expense
  history list, separate from the dashboard's "recent records" preview,
  so an authorized user can locate any confirmed record for the workspace
  — including ones no longer shown as "recent" — and open it for editing
  or deletion (Clarification, Session 2026-07-01).
- **FR-023**: The history list MUST be ordered by date (most recent
  first) and MUST distinguish income entries from expense entries. Since
  the underlying list endpoints return the full confirmed record set
  without server-side pagination or filtering this phase, any sorting or
  narrowing beyond date order MAY be performed client-side over that
  returned set.

**Categories**

- **FR-024**: The system MUST display the workspace's categories,
  including the default Saudi-first set present on every new workspace.
- **FR-025**: The system MUST let an authorized user create a custom
  category with a name.
- **FR-026**: The system MUST let an authorized user rename an existing
  category.
- **FR-027**: The system MUST let an authorized user archive a category,
  after which it MUST NOT appear as a selectable option on the expense
  form while still displaying correctly on any expense that already
  references it.

**Reports**

- **FR-028**: The system MUST provide a reports view showing the current
  period's total income, total expenses, and category breakdown for the
  active workspace, consistent with the dashboard's figures.
- **FR-029**: The system MUST show a clear empty state on the reports view
  when the workspace has no confirmed records for the current period.

**Settings and localization**

- **FR-030**: The system MUST provide a settings screen where a user can
  view and change their interface language preference between Arabic and
  English.
- **FR-031**: The system MUST re-render the interface in a right-to-left
  layout when Arabic is selected, and in a left-to-right layout when
  English is selected, without requiring a full page reload to appear
  correct.
- **FR-032**: The system MUST present all interface text used by this
  phase's screens in both Arabic and English.
- **FR-033**: The system MUST format monetary values as SAR by default
  across all screens in this phase.
- **FR-034**: The system MUST indicate, in settings, that AI features are
  optional and not required to use the app, without exposing a partially
  built AI configuration flow.

**Cross-cutting**

- **FR-035**: The system MUST show a clear empty state, distinct from an
  error state, for each of: no income yet, no expenses yet, no categories
  beyond defaults, and no team members yet.
- **FR-036**: The system MUST show a retry option when a workspace-scoped
  data request (dashboard, records, categories, reports) fails, instead of
  a blank or silently broken screen.
- **FR-037**: The system MUST re-validate a user's permitted actions against
  their current role before completing a create, edit, delete, or
  category-management action, rather than relying solely on a role held in
  client memory since the page loaded.

## Key Entities *(include if feature involves data)*

This phase does not introduce new backend data entities; it presents and
edits data already defined by earlier phases:

- **Session**: The signed-in user's authentication state, determining which
  workspaces and actions are reachable.
- **Workspace membership and role**: Determines which of the actions above
  (create/edit/delete income or expense, manage categories, create a team
  workspace) are available to the current user in the active workspace.
- **Language preference**: The user's chosen interface language
  (Arabic/English) and resulting reading direction (RTL/LTR).
- **Last active workspace**: The most recently selected workspace for the
  signed-in user, persisted client-side and used to choose which
  workspace dashboard they land on after sign-in.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can register, sign in, and see their personal
  workspace dashboard within 2 minutes without assistance.
- **SC-002**: A user can add an income record or an expense record and see
  it reflected in the dashboard's totals in under 5 seconds after
  submission.
- **SC-003**: 95% of users completing the core loop (sign in, add income,
  add an expense, view remaining balance) succeed on their first attempt
  without needing external help.
- **SC-004**: A user can complete the entire core workflow — sign in, view
  dashboard, add income, add an expense, organize with categories, view
  reports — using only manual entry, with zero dependency on any AI
  feature being configured.
- **SC-005**: Every screen delivered in this phase is fully usable in both
  Arabic (right-to-left) and English (left-to-right) presentations, with no
  mixed-direction or untranslated text.
- **SC-006**: A user who is not authorized for a given action (e.g., a
  Viewer) never sees that action succeed or produce a misleading result —
  the action is either unavailable or clearly rejected before submission.
- **SC-007**: A user working in a team workspace can confirm that its
  financial totals never include another workspace's records, in 100% of
  cases checked.

## Assumptions

- This phase covers frontend screens and client-side behavior only; it
  consumes the APIs already delivered by Phases 2-4 (authentication,
  workspaces and roles, income/expense/category management, and the
  dashboard financial summary) and introduces no new backend endpoints or
  data model changes.
- Income and expense forms include full create, edit, and delete
  capability (not create-only), since the underlying backend already
  supports edit and delete and the dashboard's recent-activity list
  naturally invites correcting a mistake there.
- The reports view in this phase reuses the current-period totals and
  category breakdown already returned by the Phase 4 dashboard endpoint.
  Multi-period trends, merchant totals, and team activity summaries
  described in the implementation plan's later reporting phase are out of
  scope here.
- Language preference and last-active-workspace are treated as
  client-side/user-level presentation state for this phase (not new
  backend-synced settings); persisting either centrally, if needed, is
  left to a later settings-focused phase.
- The income/expense history list (FR-022/FR-023) is a client-side view
  over the existing, unpaginated Phase 3 list endpoints; adding
  server-side pagination or filtering is out of scope for this phase.
- A dedicated team-member management screen (inviting, removing, or
  changing another member's role) is out of scope for this phase; the
  workspace selector only needs to let a user switch between and create
  workspaces they already belong to or own.
- Receipt/invoice upload, BYOK AI settings, AI extraction review, and the
  full multi-period reports/history suite are explicitly out of scope for
  this phase and are deferred to their respective later phases (6, 7, 8,
  and 9) per the implementation plan.
- Standard web accessibility and responsive-layout expectations apply, but
  no specific device matrix is mandated beyond general desktop and mobile
  browser usability.
