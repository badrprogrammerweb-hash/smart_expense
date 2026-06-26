# Feature Specification: Income, Expense, and Category Core

**Feature Branch**: `003-income-expense-category-core`

**Created**: 2026-06-25

**Status**: Implemented

**Input**: User description: "Phase 3 - Income, Expense, and Category Core. Implement manual income records, expense records, and categories for Smart Expense AI, building on the authentication and workspace foundation from Phase 2. Goals: Implement income records. Implement expense records. Implement categories. Implement confirmed record states. Implement create, edit, delete behavior. Implement financial recalculation rules. Exit criteria: Users can manually manage income and expenses. Categories can be managed. Confirmed records affect totals. Deleted and draft records do not affect totals."

## Clarifications

### Session 2026-06-25

- Q: The implementation plan says Members can "add income if allowed by workspace policy," but doesn't define that policy. Should this phase build a per-workspace toggle, always allow Members to add income, or never allow it? → A: Never allowed — income creation is restricted to Owners and Admins; Members and Viewers cannot create income records in this phase.
- Q: Should an expense's merchant name be a separate structured field from its description, or the same free-text field? → A: Merchant name is a separate optional field from description (two distinct fields), so later phases can group or total spending by merchant without parsing free text.
- Q: What happens when two authorized users edit or delete the same income or expense record at nearly the same time? → A: Last-write-wins — the most recent edit or delete simply applies, with no conflict error.
- Q: Can a deleted income or expense record be restored by an authorized user? → A: No restore capability in this phase — deletion is final from the user's perspective; retained data is for backend traceability only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manually record income and expenses (Priority: P1)

A signed-in workspace member manually adds income and expense entries so the workspace has real financial data to track, without needing any AI feature.

**Why this priority**: Manual income and expense entry is the core experience the entire product is built on. Without it, no workspace has any financial data and nothing else in the product (totals, reports, dashboards) has anything to calculate from.

**Independent Test**: Can be fully tested by signing in to a workspace, adding an income record and an expense record with an amount and date, and confirming both are saved and counted as confirmed records.

**Acceptance Scenarios**:

1. **Given** an Owner or Admin, **When** they add an income record with a positive amount and a date, **Then** it is saved as a confirmed record.
2. **Given** an authorized workspace member, **When** they add an expense record with a positive amount, a date, and an optional category, **Then** it is saved as a confirmed record.
3. **Given** an expense record without a category selected, **When** it is saved, **Then** the system accepts it as a valid uncategorized expense.
4. **Given** a user who is not a member of a workspace, **When** they attempt to add income or an expense to that workspace, **Then** the action is denied.

---

### User Story 2 - Edit and delete records with accurate totals (Priority: P1)

A workspace member corrects a mistake by editing or deleting an income or expense record, and the workspace's confirmed totals immediately reflect the change.

**Why this priority**: Incorrect totals destroy user trust immediately. Edit and delete behavior, and the recalculation that follows, must be correct from the first release of this feature.

**Independent Test**: Can be fully tested by editing the amount on an existing confirmed record and confirming the change is reflected, then deleting a record and confirming it no longer counts toward confirmed totals while remaining available for historical traceability.

**Acceptance Scenarios**:

1. **Given** a confirmed income or expense record, **When** an authorized user edits its amount, date, description, or category, **Then** the record's contribution to confirmed totals reflects the updated value immediately.
2. **Given** a confirmed income or expense record, **When** an authorized user deletes it, **Then** it is excluded from confirmed totals while remaining available for historical traceability rather than being permanently erased.
3. **Given** a workspace where total expenses exceed total income, **When** totals are computed, **Then** the system allows and correctly represents a negative remaining balance.
4. **Given** a Viewer, **When** they attempt to edit or delete any income or expense record, **Then** the action is denied.

---

### User Story 3 - Organize expenses with categories (Priority: P2)

A workspace member organizes expenses using the Saudi-first default categories or their own custom categories, making spending easier to understand without changing the core remaining-balance model.

**Why this priority**: Categories add clarity but are secondary to recording income and expenses and keeping totals correct, which are covered by User Stories 1 and 2.

**Independent Test**: Can be fully tested by creating a custom category, assigning it to an expense, archiving it, and confirming the expense keeps its category reference while the archived category disappears from selection for new expenses.

**Acceptance Scenarios**:

1. **Given** a newly created workspace, **When** a user views available categories, **Then** the full Saudi-first default category set is already present.
2. **Given** an authorized user, **When** they create a custom category with a name not already used in the workspace, **Then** it becomes available for new expenses.
3. **Given** an authorized user, **When** they try to create or rename a category to a name that already exists (case-insensitive) in the same workspace, **Then** the attempt is rejected and the existing category is unchanged.
4. **Given** an authorized user, **When** they archive a category that has existing expenses, **Then** those expenses keep their category reference, but the category no longer appears for new expenses.
5. **Given** a Viewer, **When** they attempt to create, rename, archive, or reorder a category, **Then** the action is denied.

---

### User Story 4 - Enforce role-based permissions across income, expense, and category management (Priority: P2)

Each workspace member's ability to create, edit, delete, or archive income, expense, and category records matches their fixed role (Owner, Admin, Member, Viewer), so financial data stays accurate and protected from unauthorized changes.

**Why this priority**: Role enforcement protects the financial data this phase introduces and must hold for every record type from the moment it exists.

**Independent Test**: Can be fully tested by assigning each fixed role to test users in the same workspace and verifying the allowed or denied outcome for creating, editing, deleting, and archiving income, expense, and category records.

**Acceptance Scenarios**:

1. **Given** an Owner or Admin, **When** they edit, delete, or archive any income, expense, or category record in their workspace, **Then** the action is allowed regardless of who created it.
2. **Given** a Member, **When** they edit or delete an expense record they created themselves, **Then** the action is allowed.
3. **Given** a Member, **When** they attempt to edit or delete an expense record created by another user, **Then** the action is denied.
4. **Given** a Member or Viewer, **When** they attempt to create an income record, **Then** the action is denied because income creation is restricted to Owners and Admins.
5. **Given** a Viewer, **When** they attempt any create, edit, delete, or archive action on income, expense, or category records, **Then** the action is denied and they retain read-only access.

### Edge Cases

- What happens when a user edits the amount on a confirmed income or expense record? Confirmed totals must reflect the updated value immediately, not the original value.
- What happens when an authorized user deletes an income or expense record? It must disappear from confirmed totals immediately while remaining available for historical traceability rather than being permanently erased.
- What happens when a workspace's total expenses exceed its total income? The system must allow and correctly represent a negative remaining balance rather than rejecting the situation.
- What happens when a Member attempts to edit or delete an income or expense record created by a different user? The action must be denied with a clear, non-sensitive message.
- What happens when a Member or Viewer attempts to create an income record? The attempt must be denied; income creation is restricted to Owners and Admins in this phase.
- What happens when a user tries to create or rename a category to a name that already exists (case-insensitive) in the same workspace? The attempt must be rejected without changing the existing category.
- What happens when a category is archived while expenses still reference it? Those expenses must keep their category reference for history, but the archived category must no longer be selectable for new expenses.
- What happens when every category in a workspace is archived? Expenses must still be creatable without a category, since category assignment is optional.
- What happens when a user submits an income or expense with a zero, negative, or missing amount, or a missing date? The system must reject the record and it must not affect totals.
- What happens when a user who is not a member of a workspace attempts to view, create, edit, or delete that workspace's income, expense, or category records? Access must be denied without revealing whether the workspace or record exists.
- What happens when two authorized users edit or delete the same income or expense record at nearly the same time? The most recent change applies (last-write-wins); the system does not reject the second change as a conflict.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow authorized Owners and Admins to create an income record with a positive amount, a date, and an optional description.
- **FR-002**: The system MUST allow authorized workspace members to create an expense record with a positive amount, a date, an optional category, an optional description, and an optional merchant name as a distinct field from the description.
- **FR-003**: The system MUST allow an expense record to be created without a category assigned; uncategorized expenses are valid.
- **FR-004**: The system MUST treat every manually created income or expense record as confirmed immediately upon creation; this phase does not introduce a manual draft or save-for-later state.
- **FR-005**: The system MUST allow authorized users to edit the amount, date, description, or (for expenses) category and merchant name, of an existing income or expense record.
- **FR-006**: The system MUST allow authorized users to delete an existing income or expense record.
- **FR-007**: The system MUST exclude a deleted income or expense record from confirmed totals while retaining it for historical traceability rather than permanently erasing it.
- **FR-008**: The system MUST recalculate confirmed total income and confirmed total expenses immediately whenever an income or expense record is created, edited, or deleted, so any later consumer of those totals sees the current correct value.
- **FR-009**: The system MUST ensure that confirmed total income and confirmed total expenses, wherever computed, include only confirmed, non-deleted records.
- **FR-010**: The system MUST associate every income, expense, and category record with exactly one workspace.
- **FR-011**: The system MUST prevent users from creating, viewing, editing, deleting, or archiving income, expense, or category records in a workspace where they are not a member, consistent with the tenant isolation established in Phase 2.
- **FR-012**: Owners and Admins MUST be able to create, edit, delete, or archive any income, expense, or category record in their workspace, regardless of who created it.
- **FR-013**: Members MUST be able to create expense records and edit or delete the expense records they personally created; Members MUST NOT edit or delete expense records created by another user.
- **FR-014**: The system MUST restrict income record creation to Owners and Admins; Members and Viewers MUST NOT be able to create income records in this phase.
- **FR-015**: Viewers MUST NOT be able to create, edit, delete, or archive any income, expense, or category record; Viewers retain read-only access to confirmed records.
- **FR-016**: The system MUST provide every workspace with the standard Saudi-first default category set (Restaurants, Groceries, Fuel, Transportation, Rent, Utilities, Internet & Mobile, Health, Education, Family, Shopping, Entertainment, Travel, Subscriptions, Other) at the time the workspace is created.
- **FR-017**: The system MUST allow authorized users to create additional custom categories scoped to their workspace.
- **FR-018**: The system MUST reject a new or renamed category whose name duplicates (case-insensitive) another active category name already in the same workspace.
- **FR-019**: The system MUST allow authorized users to rename an existing category.
- **FR-020**: The system MUST allow authorized users to archive a category instead of permanently deleting it.
- **FR-021**: The system MUST keep an archived category's association with existing expenses intact while preventing the archived category from being selected for new expenses.
- **FR-022**: The system MUST allow authorized users to reorder the display order of a workspace's categories.
- **FR-023**: The system MUST store and calculate income and expense amounts using integer minor currency units or fixed-precision decimals; floating-point arithmetic MUST NOT be used for amount storage or calculation.
- **FR-024**: SAR MUST be the default currency for every income and expense record created in this phase.
- **FR-025**: The system MUST reject income or expense records with a zero, negative, or missing amount.
- **FR-026**: The system MUST reject income or expense records that are missing a valid date.
- **FR-027**: The system MUST return clear, non-sensitive denial messages when an unauthenticated, unauthorized, or invalid-role action is attempted against income, expense, or category records.
- **FR-028**: The system MUST NOT implement receipt or invoice file upload, AI extraction, dashboard or report aggregation endpoints, or activity history logging as part of this phase; those capabilities are addressed in later phases.
- **FR-029**: When two authorized users edit or delete the same income or expense record at nearly the same time, the system MUST apply the most recently submitted change (last-write-wins) without returning a conflict error.
- **FR-030**: The system MUST NOT provide a user-facing capability to restore a deleted income or expense record in this phase; deletion is final from the user's perspective, and retained data exists only for backend traceability.

### Key Entities

- **Income Record**: Confirmed money entering a workspace, manually entered in this phase. Carries an amount, a date, an optional description, the workspace it belongs to, the user who created it, and a confirmation state.
- **Expense Record**: Confirmed money leaving a workspace, manually entered in this phase. Carries an amount, a date, an optional category, an optional description, an optional merchant name (distinct from the description, so spending can later be grouped or totaled by merchant), the workspace it belongs to, the user who created it, and a confirmation state. Reserved to link to a receipt or invoice file in a later phase.
- **Category**: A workspace-scoped label used to organize expenses. Carries a name, a display order, an active/archived flag, and the workspace it belongs to. Includes the Saudi-first default set plus any custom categories the workspace creates.
- **Record Confirmation State**: The status that determines whether an income or expense record counts toward a workspace's confirmed totals. In this phase, manually created records are confirmed immediately and may later become deleted; the model is designed so a future AI-extraction phase can add draft and pending states without breaking confirmed-total accuracy.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can record a new income or expense entry, including amount and date, in under 1 minute.
- **SC-002**: 100% of confirmed income and expense records correctly contribute to their workspace's confirmed totals immediately after creation, edit, or deletion.
- **SC-003**: 100% of deleted or non-confirmed income and expense records are excluded from confirmed totals.
- **SC-004**: 100% of category management actions (create, rename, archive, reorder) by authorized roles succeed, and 100% of attempts by unauthorized roles are denied.
- **SC-005**: Every new workspace has the full Saudi-first default category set available immediately upon creation, with no manual setup required.
- **SC-006**: 100% of verified cross-workspace access attempts against income, expense, or category records by non-members are denied.
- **SC-007**: Users can manage their full set of expense categories (create, rename, archive, reorder) without needing technical support.

## Assumptions

- Income records do not carry a category or "source" classification in this phase; only expenses are categorized.
- Manual income and expense entries are confirmed immediately upon creation; there is no manual draft or save-for-later workflow in this phase. Draft and pending states are reserved for AI extraction results introduced in a later phase.
- Deleting an income or expense record is a soft delete: the record is excluded from active totals but retained for historical traceability, consistent with the project's financial accuracy rule. There is no user-facing restore capability in this phase; retention exists only for backend traceability and future history features.
- Categories are archived rather than permanently deleted, preserving historical association with existing expenses; archived categories are hidden from selection for new expenses.
- Receipt and invoice file linkage for expenses is deferred to a later phase; this phase only ensures the expense data model can later support that link.
- Full dashboard data, trend calculations, and report aggregation are deferred to later phases; this phase guarantees only that confirmed income and expense records are correctly identifiable as accurate input for those later calculations.
- AI-extraction-originated expenses, AI review states, and history/activity logging for income, expense, and category changes are deferred to later phases.
- Income and expense dates may be in the past or present; this phase does not restrict backdating or future-dating.
