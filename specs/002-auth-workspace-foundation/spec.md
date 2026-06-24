# Feature Specification: Authentication and Workspace Foundation

**Feature Branch**: `002-auth-workspace-foundation`

**Created**: 2026-06-24

**Status**: Implemented

**Input**: User description: "Phase 2 - Supabase Auth and Workspace Foundation. Build the Supabase authentication and workspace foundation for Smart Expense AI. This phase must configure email/password authentication, create the workspace model, create the workspace membership model, create default personal workspace behavior, support minimal team workspaces, define fixed role permissions, and add tenant isolation policies. Goals: Configure Supabase Auth with email/password only. Create user profile behavior after signup. Create a personal workspace automatically for each user. Create workspace and workspace_membership database models. Support minimal team workspace creation and access. Define fixed roles: Owner, Admin, Member, Viewer. Enforce role permissions. Add tenant isolation policies using Supabase RLS. Exit criteria: Users can authenticate. Users can access their personal workspace. Users can create or access team workspaces. Workspace membership and roles are enforced. Tenant isolation prevents users from accessing other workspaces."

## Clarifications

### Session 2026-06-24

- Q: Can a workspace be deleted or archived in this phase, and if so what happens to its memberships? → A: Out of scope for this phase — no delete/archive capability exists yet; revisit in a later phase.
- Q: What is the maximum number of members a team workspace can have in this phase? → A: Fixed small cap of up to 10 members per team workspace.
- Q: Can a member voluntarily leave a team workspace, and what happens if the last Owner tries to leave? → A: Any member can leave voluntarily; the sole remaining Owner cannot leave until another Owner exists.
- Q: What happens when an Owner/Admin tries to add a user who is already a member of that team workspace? → A: Reject the duplicate add with a clear message; existing role is unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign up and enter a personal workspace (Priority: P1)

A new user creates an account with email and password, then lands in a private personal workspace that belongs only to them and is ready for future income, expense, category, file, and report data.

**Why this priority**: Authentication and a guaranteed personal workspace are the entry point for every later product feature. Without this, no user can safely own financial data.

**Independent Test**: Can be fully tested by registering a new account with a valid email and password, signing in, and confirming that the user has a profile, exactly one default personal workspace, and Owner access to that workspace.

**Acceptance Scenarios**:

1. **Given** a visitor with no account, **When** they sign up with a valid email and password, **Then** their account is created and they can sign in with those credentials.
2. **Given** a newly registered user, **When** account setup completes, **Then** the system creates a user profile, a personal workspace, and an Owner membership for that user.
3. **Given** a signed-in user with a personal workspace, **When** they open the application, **Then** they can view and select that personal workspace without any team setup.
4. **Given** a visitor who has not signed in, **When** they attempt to access a protected workspace area, **Then** they are denied access and directed to authenticate.

---

### User Story 2 - Create and access a minimal team workspace (Priority: P2)

A signed-in user creates a team workspace for shared household, couple, family, or small-team expense tracking, then grants another existing user access with one of the fixed roles.

**Why this priority**: The product constitution includes personal and team workspaces in the MVP. A small, clear team model is needed before workspace-owned financial records are introduced.

**Independent Test**: Can be fully tested by having one signed-in user create a team workspace, add a second existing user as a member, and verify that both users can see the same workspace while non-members cannot.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they create a team workspace with a valid name, **Then** the workspace is created and the creator becomes its Owner.
2. **Given** a team workspace Owner or Admin, **When** they add an existing user to the team workspace with a valid role, **Then** that user becomes a workspace member with only the permissions for that role.
3. **Given** a signed-in user who belongs to multiple workspaces, **When** they view available workspaces, **Then** they see only their personal workspace and team workspaces where they are a member.
4. **Given** a signed-in user who is not a member of a workspace, **When** they attempt to open it, **Then** access is denied.
5. **Given** a team workspace member who is not the sole Owner, **When** they choose to leave the workspace, **Then** their membership is removed and they immediately lose access to that workspace.

---

### User Story 3 - Enforce fixed workspace roles (Priority: P2)

A workspace Owner manages who can administer, contribute to, or only view a workspace through four fixed roles: Owner, Admin, Member, and Viewer.

**Why this priority**: Role enforcement protects financial data and prevents accidental or unauthorized changes, especially before income, expense, receipt, and report records are added.

**Independent Test**: Can be fully tested by assigning each fixed role to test users and verifying the allowed and denied actions for workspace viewing, workspace updates, member management, and protected modifications.

**Acceptance Scenarios**:

1. **Given** a workspace Owner, **When** they manage workspace settings or members, **Then** the action is allowed.
2. **Given** a workspace Admin, **When** they manage regular workspace members or update workspace details, **Then** the action is allowed, but ownership-only actions remain denied.
3. **Given** a workspace Member, **When** they view the workspace or perform normal contributor actions, **Then** the action is allowed, but member management and administrative workspace changes are denied.
4. **Given** a workspace Viewer, **When** they view workspace information, **Then** read access is allowed, but any modification attempt is denied.

---

### User Story 4 - Preserve tenant isolation across workspaces (Priority: P1)

A user can only see and act on data that belongs to workspaces where they are a member, even if they know or guess another workspace identifier.

**Why this priority**: Workspace isolation is a trust and privacy requirement for financial data. It must exist before any workspace-owned business records are introduced.

**Independent Test**: Can be fully tested by creating two users with separate workspaces and confirming that direct attempts to view, list, update, or join the other user's workspace are denied.

**Acceptance Scenarios**:

1. **Given** User A owns Workspace A and User B owns Workspace B, **When** User A tries to access Workspace B directly, **Then** the request is denied.
2. **Given** a workspace member list, **When** a user who is not a member attempts to view it, **Then** the system denies access.
3. **Given** a user removed from a team workspace, **When** they refresh their workspace list or attempt direct access, **Then** the removed workspace is no longer accessible.

### Edge Cases

- What happens if profile or personal workspace creation is triggered more than once for the same new account? The system must keep one profile, one personal workspace, and one Owner membership for that account.
- What happens if a user signs in but their expected personal workspace is missing due to an interrupted signup process? The system must repair or recreate the missing personal workspace before the user continues into protected workspace areas.
- What happens when an Owner attempts to remove or demote the last remaining Owner of a workspace? The system must deny the action so every workspace always retains an Owner.
- What happens when a team workspace member is added with an email that does not belong to an existing account? The system must not create a hidden account or expose private user data; the add attempt must fail with a clear, non-sensitive message.
- What happens when a user requests a workspace identifier that does not belong to them? The denial must not reveal private details about that workspace.
- What happens if a workspace is renamed or a member role changes while another member is active? The next protected action must use the latest workspace membership and role.
- What happens when an Owner or Admin tries to add a member to a team workspace that already has 10 members? The system must deny the addition and clearly indicate the workspace has reached its member limit.
- What happens when the last remaining Owner of a team workspace attempts to leave it? The system must deny the action until that Owner promotes another member to the Owner role.
- What happens when an Owner or Admin tries to add a user who is already a member of that team workspace? The system must reject the duplicate add with a clear, non-sensitive message and leave the existing membership role unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow users to create an account and sign in using email and password.
- **FR-002**: The system MUST NOT allow social login, single sign-on, magic-link-only login, or phone-number login in this phase.
- **FR-003**: The system MUST create and maintain one user profile for each authenticated user.
- **FR-004**: The system MUST automatically create one personal workspace for each new user.
- **FR-005**: The system MUST make the new user the Owner of their personal workspace.
- **FR-006**: The system MUST allow an authenticated user to access their personal workspace after sign-in.
- **FR-007**: The system MUST allow an authenticated user to create a team workspace.
- **FR-008**: The system MUST make the creator of a team workspace an Owner of that workspace.
- **FR-009**: The system MUST allow authorized workspace administrators to add existing users to a team workspace.
- **FR-010**: The system MUST store each workspace membership with exactly one fixed role: Owner, Admin, Member, or Viewer.
- **FR-011**: The system MUST reject any workspace membership role outside the fixed role set.
- **FR-012**: The system MUST enforce the fixed permission model for workspace access, workspace updates, member management, and protected modifications.
- **FR-013**: Owners MUST be able to manage workspace settings, manage members, assign roles, and perform ownership-only workspace actions.
- **FR-014**: Admins MUST be able to manage regular workspace details and non-owner members, but MUST NOT remove, demote, or override Owners.
- **FR-015**: Members MUST be able to access the workspace and perform normal contributor actions, but MUST NOT manage workspace membership or administrative settings.
- **FR-016**: Viewers MUST be able to read workspace information, but MUST NOT create, update, or delete workspace records.
- **FR-017**: The system MUST prevent removal, demotion, or voluntary departure of the last Owner of any workspace; an Owner may leave only after promoting another member to the Owner role.
- **FR-018**: The system MUST list only the workspaces where the signed-in user is currently a member.
- **FR-019**: The system MUST prevent users from viewing, listing, updating, deleting, or joining workspaces where they are not members.
- **FR-020**: The system MUST prevent users from viewing or changing workspace memberships for workspaces where they lack the required role.
- **FR-021**: The system MUST ensure every workspace-owned record introduced by this phase is associated with exactly one workspace.
- **FR-022**: The system MUST apply workspace membership and role checks to every protected workspace action, regardless of how the action is initiated.
- **FR-023**: The system MUST return clear, non-sensitive denial messages for unauthenticated, unauthorized, or invalid role attempts.
- **FR-024**: The system MUST avoid exposing whether a private workspace exists when the requester is not authorized to access it.
- **FR-025**: The system MUST enforce tenant isolation using Supabase Row Level Security policies, not application checks only.
- **FR-026**: The system MUST NOT implement income, expenses, categories, reports, receipt uploads, AI extraction, payment, subscription, or billing features in this phase.
- **FR-027**: Members MUST NOT be allowed to manage income when income features are introduced in later phases.
- **FR-028**: Viewers MUST remain read-only for all current and future workspace-owned records.
- **FR-029**: The system MUST NOT provide workspace deletion or archival capability in this phase; workspaces created in this phase persist, and deletion/archival behavior is deferred to a future phase.
- **FR-030**: The system MUST limit a team workspace to a maximum of 10 members and MUST reject any attempt to add a member beyond that limit.
- **FR-031**: The system MUST allow any team workspace member, except a sole remaining Owner, to voluntarily leave that workspace.
- **FR-032**: The system MUST reject attempts to add a user to a team workspace where they are already a member, leaving their existing role unchanged.

### Key Entities

- **User Profile**: A user's application profile connected to their authenticated account. It represents the user inside Smart Expense AI and is used to associate them with workspaces.
- **Workspace**: A tenant boundary for personal or team financial activity. Every workspace has a type, a display name, an Owner, and a membership list. Team workspaces are limited to a maximum of 10 members in this phase.
- **Workspace Membership**: The relationship between a user profile and a workspace. It records which role the user has in that workspace and determines access.
- **Workspace Role**: A fixed permission level assigned to a workspace membership. Allowed roles are Owner, Admin, Member, and Viewer.
- **Workspace Access Rule**: The required isolation and permission behavior that decides whether a user may view or modify a workspace or its membership records.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can create an account, sign in, and reach their personal workspace in under 2 minutes.
- **SC-002**: 100% of newly registered users have exactly one user profile, exactly one personal workspace, and Owner membership in that personal workspace after signup completion.
- **SC-003**: A signed-in user can create a team workspace and add one existing user with a fixed role in under 3 minutes.
- **SC-004**: 100% of role-permission verification cases for Owner, Admin, Member, and Viewer produce the expected allowed or denied result.
- **SC-005**: 100% of verified cross-workspace access attempts by non-members are denied.
- **SC-006**: 100% of workspace lists shown to users contain only workspaces where the user is currently a member.
- **SC-007**: No social login, single sign-on, magic-link-only login, or phone-number login entry point is available in this phase.
- **SC-008**: A removed team workspace member loses access to that workspace on their next protected action.

## Assumptions

- Email/password is the only authentication method for this phase; password recovery and email confirmation may follow the authentication provider's standard secure behavior but do not add other login methods.
- A personal workspace is owned by exactly one user at creation time and is not intended to be a team collaboration space.
- The fixed role names and broad permission meanings are product rules and are not user-customizable in the MVP.
- Workspace isolation in this phase applies to authentication, user profiles, workspaces, and workspace memberships. Later phases must extend the same isolation model to income, expenses, categories, files, AI extraction jobs, reports, settings, and activity history.
- Minimal team workspace support in this phase means adding existing registered users by email. Email invite links, shareable invite links, approval flows, ownership transfer, billing seats, and enterprise permission customization are out of scope.
