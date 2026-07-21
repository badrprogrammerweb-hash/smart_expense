# Feature Specification: Hierarchical Categories

**Feature Branch**: `013-hierarchical-categories`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "Phase 13 — Hierarchical Categories: Add main categories and one level of subcategories; separate income categories from expense categories; expand the default category catalog; allow users to create, edit, disable, and organize categories; preserve categories linked to historical records; update income, expense, reports, and AI extraction flows; support translated names for system-provided categories."

## Clarifications

### Session 2026-07-21

- Q: When this phase ships, should the expanded default category catalog (new expense subcategories, and the entirely new income category tree) be backfilled onto workspaces that already exist, or only applied to newly created workspaces going forward? → A: Backfill all existing workspaces as part of the migration — every existing workspace gets the new subcategories under its existing main expense categories, and the new default income main+subcategory tree, seeded the same way a brand-new workspace would receive them. This avoids a two-tier experience where only new signups get the improved catalog.
- Q: If a subcategory is individually marked active but its parent main category is disabled, is the subcategory selectable? → A: No — effective selectability requires both the subcategory itself AND its parent main category to be active. Disabling a main category hides all of its subcategories from selection without changing each subcategory's own stored active/disabled flag, so re-enabling the parent immediately restores whichever subcategories were still individually active.
- Q: What concrete default categories/subcategories make up the expanded catalog referenced by FR-005? → A: Locked to the specific lists below (see Assumptions → Default Catalog), covering an income tree that does not exist today and new subcategories nested under each of the 15 existing expense main categories where a meaningful split applies.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Categorize a record with a main category and subcategory (Priority: P1)

A workspace member recording an expense or income wants to classify it more precisely than a single flat category — for example "Transportation" as the main category and "Fuel" as the subcategory — so that spending patterns within a broad area are visible.

**Why this priority**: This is the core value of the phase. Without a working main+subcategory selection on the record form, none of the other capabilities (reports drill-down, AI suggestions, catalog management) have anything to attach to.

**Independent Test**: Create an expense and select a main category with one of its subcategories; save the record; confirm the record displays both the main category and subcategory. Create another expense with only a main category (no subcategory) and confirm it saves and displays correctly. Can be fully tested against the existing income/expense flows without reports or AI extraction changes present.

**Acceptance Scenarios**:

1. **Given** a workspace with default expense categories, **When** a member creates an expense and selects a main category and one of its subcategories, **Then** the expense is saved with both the main category and subcategory recorded and both are shown wherever the expense is displayed.
2. **Given** a workspace with default expense categories, **When** a member creates an expense and selects only a main category, leaving the subcategory unset, **Then** the expense saves successfully showing the main category and no subcategory.
3. **Given** a workspace with default income categories, **When** a member creates an income record and selects a main category and subcategory, **Then** the income record is saved and displayed the same way expenses are.
4. **Given** an expense being edited, **When** a member changes the subcategory to a different subcategory under the same main category, **Then** the update succeeds and the change is reflected immediately.
5. **Given** an expense being edited, **When** a member changes the main category, **Then** any previously selected subcategory that does not belong to the new main category is cleared and the member must pick a new subcategory or leave it unset.

---

### User Story 2 - Manage the category catalog (create, edit, disable, organize) (Priority: P1)

A workspace owner or admin wants to tailor the category catalog to their household or team: adding a new main category or subcategory, renaming one, disabling ones they don't use, and reordering them for a catalog that matches how they actually think about their spending and income.

**Why this priority**: Category management is required to make the hierarchical model usable in practice — without it, users are stuck with only the expanded default catalog and cannot adapt it, which was already a limitation being solved for in this phase.

**Independent Test**: As an owner/admin, create a new main category, add a subcategory under it, rename a subcategory, disable a subcategory, and reorder main categories; confirm each change is visible in the category list and available (or unavailable, once disabled) when recording income/expenses. Testable independently of reports and AI extraction.

**Acceptance Scenarios**:

1. **Given** a workspace owner or admin viewing the category catalog, **When** they create a new main category for either income or expense, **Then** it appears in the catalog for that record type only and is immediately selectable on new records.
2. **Given** an existing main category, **When** an owner or admin adds a subcategory under it, **Then** the subcategory appears nested under that main category and is selectable once its parent is chosen.
3. **Given** an existing category or subcategory, **When** an owner or admin renames it, **Then** the new name is shown going forward, including on historical records that reference it.
4. **Given** an existing category or subcategory that is no longer needed, **When** an owner or admin disables it, **Then** it is no longer selectable for new records but remains visible and intact on any historical record already using it.
5. **Given** a disabled category or subcategory, **When** an owner or admin re-enables it, **Then** it becomes selectable for new records again.
6. **Given** a main category with one or more active subcategories, **When** an owner or admin disables the main category, **Then** the main category and all of its subcategories become unavailable for new records together, without needing to disable each subcategory individually.
7. **Given** the category catalog, **When** an owner or admin reorders main categories (and, within a main category, its subcategories), **Then** the new order is reflected everywhere categories are listed for selection or review.
8. **Given** a member with the viewer role, **When** they open the category management screen, **Then** they can see the catalog but cannot create, edit, disable, or reorder anything.
9. **Given** an owner or admin attempting to create a category or subcategory, **When** the name duplicates another active name at the same level under the same parent (or another active main category name of the same type), **Then** the system rejects the action with a clear message.

---

### User Story 3 - Drill into reports by main category and subcategory (Priority: P2)

A workspace member reviewing reports wants to see spending or income summarized by main category, and then drill into a specific main category to see how it breaks down across its subcategories.

**Why this priority**: Reporting is a key consumer of categorization and delivers the analytical payoff of the hierarchy, but the underlying record-keeping (User Story 1) must exist first.

**Independent Test**: With historical records tagged across several main categories and subcategories, open the reports view; confirm the top-level breakdown groups by main category, and selecting a main category reveals its subcategory breakdown. Testable once records carry main+subcategory data, independent of AI extraction changes.

**Acceptance Scenarios**:

1. **Given** a workspace with expenses across multiple main categories, **When** a member views the category breakdown report, **Then** amounts are grouped and totaled by main category.
2. **Given** a main category with expenses spread across several subcategories, **When** a member selects that main category in the report, **Then** they see a breakdown of amounts by subcategory within it.
3. **Given** expenses recorded against a category that has since been disabled or renamed, **When** a member views a report for the period containing those expenses, **Then** the amounts are still included in the totals and shown under the category's current display name.
4. **Given** records with no subcategory selected, **When** a member drills into that main category, **Then** those records are grouped under an explicit "no subcategory" bucket rather than being dropped from the total.

---

### User Story 4 - AI extraction suggests a subcategory for review (Priority: P3)

A user extracting an expense from a receipt using AI wants the system to suggest a plausible main category and subcategory based on the receipt content, which they can accept, change, or clear during manual review before confirming.

**Why this priority**: This enhances the existing AI-assisted workflow but is not required for the hierarchical model itself to function; it depends on the record and catalog changes from User Stories 1–2 being in place first.

**Independent Test**: Run AI extraction on a sample receipt; confirm the review screen shows a suggested main category and, where applicable, a suggested subcategory, both of which remain editable and unconfirmed until the user reviews and confirms the record. Testable independently of the reports changes in User Story 3.

**Acceptance Scenarios**:

1. **Given** an AI extraction result for a receipt with clear merchant/item context, **When** the review screen is shown, **Then** a suggested main category and, if determinable, a suggested subcategory are pre-filled but not yet confirmed.
2. **Given** a suggested main category and subcategory on the review screen, **When** the user changes either before confirming, **Then** the confirmed expense reflects the user's final selection, not the original suggestion.
3. **Given** an AI extraction result where no confident subcategory suggestion exists, **When** the review screen is shown, **Then** the main category suggestion (if any) is shown with no subcategory pre-selected, and the user can still pick one manually.
4. **Given** an AI suggestion for a category or subcategory that is currently disabled in the workspace, **When** the review screen is shown, **Then** the disabled suggestion is not pre-filled as a selectable choice, and the user selects a category manually instead.

---

### Edge Cases

- What happens when a user tries to create a subcategory under a category that belongs to the other record type (e.g., an expense subcategory under an income main category)? The system must reject this — subcategories always belong to exactly one main category of the same record type.
- What happens when a workspace has zero active main categories left for a record type (all disabled)? Users must still be able to record income/expense with category left unset; the system must not block core record entry on category availability, and management screens should surface that no active categories remain.
- What happens when a subcategory is individually active but its parent main category is disabled? It is not selectable — a subcategory is only offered for selection when both it and its parent main category are active. Its own active/disabled flag is left untouched, so re-enabling the parent immediately restores whichever subcategories were still individually active, with no need to re-enable each one.
- What happens when two users concurrently reorder the category list? The system must resolve to a single consistent final order without corrupting sort positions (consistent with existing single-level category reordering behavior).
- What happens to a subcategory when its parent main category is deleted rather than disabled? Deletion of a category/subcategory that is referenced by any historical record is not permitted — only disabling is allowed once a category has been used; only completely unused categories/subcategories may be removed outright.
- How does the system handle a workspace created before this phase, whose existing flat categories become main expense categories with no subcategories and no explicit record type on old data? The migration must assign existing categories to the "expense" type (since only expenses referenced categories previously) and preserve every historical expense's existing category link unchanged.
- What happens when the interface language is switched (Arabic/English)? System-provided category and subcategory names must display in the active language; user-created categories keep the exact name the user typed regardless of language.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support two independent category trees per workspace, one for income and one for expense, each containing main categories and, optionally, one level of subcategories nested under a main category.
- **FR-002**: System MUST prevent a subcategory from being associated with a main category of a different record type (income vs. expense) or with another subcategory (no more than one level of nesting).
- **FR-003**: System MUST allow income records to carry an optional main category and optional subcategory, matching the capability already available to expense records.
- **FR-004**: System MUST allow a record (income or expense) to be saved with a main category and no subcategory, but MUST NOT allow a subcategory to be saved without its corresponding main category.
- **FR-005**: System MUST provide an expanded set of default, system-provided main categories and subcategories for both income and expense trees, seeded automatically for new workspaces, while preserving every category name already required by the product's default catalog.
- **FR-006**: System MUST display the name of system-provided categories and subcategories in the workspace's active interface language (Arabic/English), consistent with existing localization behavior, while user-created categories always display exactly as entered.
- **FR-007**: System MUST allow workspace owners and admins to create new main categories and subcategories for either the income or expense tree.
- **FR-008**: System MUST allow workspace owners and admins to rename any main category or subcategory, including system-provided ones, without affecting historical records that used the prior name (historical records show the current name, not a frozen snapshot).
- **FR-009**: System MUST allow workspace owners and admins to disable (and re-enable) any main category or subcategory. Disabling a main category MUST also make all of its subcategories unavailable for new selection without individually disabling each one; a subcategory is only selectable when both it and its parent main category are active, and re-enabling a parent MUST immediately restore selectability of any subcategory still individually marked active, without requiring each subcategory to be re-enabled separately.
- **FR-010**: System MUST prevent selection of disabled categories and subcategories on new or edited records, while continuing to display them, unchanged, wherever they are already referenced by historical records.
- **FR-011**: System MUST allow workspace owners and admins to reorder main categories within a tree, and reorder subcategories within their parent, with the resulting order reflected consistently everywhere categories are listed.
- **FR-012**: System MUST reject creation or rename operations that would produce a duplicate active name among sibling subcategories under the same main category, or among active main categories of the same record type.
- **FR-013**: System MUST restrict category/subcategory create, edit, disable/enable, and reorder actions to workspace owners and admins; viewers and other members MUST be able to view the catalog but not modify it, consistent with existing workspace role permissions.
- **FR-014**: System MUST prevent permanent deletion of any category or subcategory that is referenced by at least one historical income or expense record; only categories/subcategories with zero historical references may be permanently removed. Disabling remains the supported way to retire a category/subcategory that has been used.
- **FR-015**: System MUST migrate existing workspace category data so that every pre-existing category becomes an expense-tree main category with no subcategory, and every existing expense record's category reference continues to resolve to the same category, unchanged, after migration.
- **FR-015a**: System MUST backfill the expanded default catalog onto every existing workspace as part of this phase's migration, not only onto newly created workspaces: existing workspaces MUST receive the new default subcategories nested under their existing main expense categories, and MUST receive the new default income main+subcategory tree, seeded equivalently to how a new workspace would receive both trees.
- **FR-016**: System MUST provide a category breakdown in reports grouped by main category, with the ability to drill into a selected main category to see amounts broken down by its subcategories, including an explicit grouping for records with a main category but no subcategory.
- **FR-017**: Report category breakdowns MUST include amounts from records referencing disabled or renamed categories, displayed under the category's current name.
- **FR-018**: AI extraction MUST be able to propose a suggested main category and, where determinable, a suggested subcategory for a record under review, without automatically confirming the record.
- **FR-019**: System MUST allow the user to accept, change, or clear an AI-suggested main category or subcategory during manual review, and MUST only persist the user's final confirmed selection.
- **FR-020**: System MUST NOT pre-fill an AI-suggested main category or subcategory that is currently disabled in the workspace; the user selects a replacement manually in that case.
- **FR-021**: System MUST continue to enforce that every category or subcategory belongs to exactly one workspace and cannot be selected by records in a different workspace (existing tenant isolation extended to the new hierarchy).

### Key Entities

- **Main Category**: A top-level grouping within one workspace's income or expense tree. Attributes: name (as displayed; may be a translation key for system-provided categories or free text for user-created ones), record type (income or expense), active/disabled state, display order, whether it is system-provided or user-created.
- **Subcategory**: A second-level grouping nested under exactly one main category, inheriting that main category's record type. Attributes: name (translated or free text, same rules as main category), active/disabled state, display order within its parent, whether it is system-provided or user-created. A subcategory cannot exist without a parent main category and cannot itself have children.
- **Income Record / Expense Record**: Existing entities, extended to optionally reference one main category and, if a main category is set, optionally one subcategory belonging to that main category.
- **AI Extraction Suggestion**: Existing entity, extended to optionally carry a suggested main category and suggested subcategory alongside its other suggested fields, subject to manual review before confirmation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of income and expense records created after this phase ships can be saved with a main category alone, or a main category plus subcategory, with no increase in record-save failure rate compared to before the phase.
- **SC-002**: 100% of expense records that existed before this phase continue to display their original category, unchanged, after the migration to the hierarchical model.
- **SC-003**: Workspace owners/admins can create a new subcategory and have it available for selection on a new record in under 30 seconds of interaction, without needing external documentation.
- **SC-004**: Reports category breakdown reflects 100% of confirmed income/expense totals for a period, whether or not the referenced category is later disabled or renamed.
- **SC-005**: In at least 80% of AI extractions performed on receipts with a clearly identifiable merchant or item type, a main category suggestion is presented for the user's review.
- **SC-006**: Disabling a category removes it from selection on new records immediately (next record creation), while 100% of prior records referencing it remain fully visible and correctly categorized.

## Assumptions

- Only one level of subcategory nesting is required for this phase; deeper nesting (sub-subcategories) is out of scope.
- **Default Catalog** (locked during clarification, applies to every new workspace and is backfilled onto every existing workspace per FR-015a):
  - Expense tree — existing 15 main categories are preserved unchanged (Restaurants, Groceries, Fuel, Transportation, Rent, Utilities, Internet & Mobile, Health, Education, Family, Shopping, Entertainment, Travel, Subscriptions, Other), with new default subcategories added under the categories where a meaningful split exists:
    - Restaurants: Dining Out, Cafes & Coffee, Delivery
    - Groceries: Supermarket, Bulk & Wholesale
    - Transportation: Public Transit, Ride-Hailing, Parking & Tolls, Vehicle Maintenance
    - Utilities: Electricity, Water, Gas
    - Internet & Mobile: Internet, Mobile Plan
    - Health: Doctor Visits, Pharmacy, Insurance
    - Education: Tuition, Books & Supplies, Courses
    - Family: Childcare, Household Help
    - Shopping: Clothing, Electronics, Home Goods
    - Entertainment: Movies & Events, Hobbies, Games & Apps
    - Travel: Flights, Hotels, Activities
    - Subscriptions: Streaming, Software, Memberships
    - Fuel, Rent, and Other keep no subcategories by default (each is already a specific-enough single concept).
  - Income tree (new — none exists today): Salary, Business Income, Gifts, Investment Returns, Other Income, with subcategories where a meaningful split exists:
    - Salary: Primary Job, Bonus & Commission
    - Business Income: Sales Revenue, Services Revenue
    - Investment Returns: Dividends, Interest
    - Gifts and Other Income keep no subcategories by default.
  - This list is the seed data for migration and new-workspace provisioning; it is not a hard cap — owners/admins can add further main categories or subcategories per FR-007.
- "Organize" in the phase goals is interpreted as reordering (existing behavior for the flat list, extended to two levels) plus create/edit/disable, not a separate bulk-import or drag-and-drop-specific mechanic — the interaction mechanism for reordering is an implementation detail for planning, not a spec-level requirement.
- Translated display names for system-provided categories reuse the existing i18n message-catalog mechanism introduced in Phase 12; no new translation infrastructure is introduced.
- Historical records store a stable reference (id) to the category/subcategory, not a copied name, which is why renames propagate to historical displays — consistent with the existing single-level category design.
- Category/subcategory names remain scoped per workspace, per record type, per parent — the same uniqueness and isolation model already enforced for the flat category list, extended one level deeper.
- AI category suggestions map to the existing BYOK, manual-review-before-confirm flow (Principle V) and never auto-confirm a record; this phase does not change that guarantee.
- Deleting (not disabling) a category/subcategory is only possible when it has zero historical references; this is a safety rule, not a user-facing bulk-cleanup feature, and is not expected to be commonly used.
