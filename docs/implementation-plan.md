# Smart Expense - AI Implementation Plan

## Plan Metadata

**Project:** Smart Expense - AI
**Domain:** smartexpense.ai
**Plan Type:** Spec-Kit Implementation Plan
**Version:** 1.0.0
**MVP Status:** Free, no payment gateway, no subscription billing
**Architecture:** Monolith repository
**Primary Market:** Saudi-first
**Core Model:** Income-driven decreasing balance budgeting
**AI Model:** Optional BYOK using Gemini or OpenAI
**Deployment Target:** Bunny Magic Containers
**Constitution:** Must comply with `speckit.constitution.md`

---

## 1. Executive Summary

Smart Expense - AI is a Saudi-first, multi-tenant SaaS application for tracking income, expenses, receipts, invoices, and remaining balance.

The MVP must support individuals, families, couples, and small teams. It must work fully without AI. AI features are optional and require the user to provide their own Gemini or OpenAI key.

The product is centered on one core financial question:

> How much income came in, how much was spent, and how much remains?

The primary financial formula is:

> Remaining Balance = Confirmed Total Income - Confirmed Total Expenses

The MVP must avoid bank connections, payment gateways, subscription billing, full accounting features, payroll, tax features, investment tracking, and enterprise-grade workflows.

---

## 2. Technical Context

### Frontend

The frontend will be built using:

* Next.js 16.x (Active LTS), kept on the latest patched 16.x release
* React
* Tailwind CSS
* Shadcn UI

The frontend is responsible for:

* User interface
* Authentication screens
* Workspace selection
* Dashboard views
* Income and expense forms
* Category management
* Receipt and invoice upload UI
* AI extraction review UI
* Reports UI
* Settings UI
* Arabic and English readiness
* RTL layout readiness
* SAR-first presentation

The frontend must not be the source of truth for financial calculations or permissions.

Frontend calculations may be used only for display previews and must never override backend or database truth.

### Backend

The backend will be built using:

* Python
* FastAPI

The backend is responsible for:

* Financial calculation logic
* Remaining balance calculation
* Income totals
* Expense totals
* Report aggregation
* Workspace authorization
* Role validation
* AI extraction orchestration
* Duplicate detection
* File metadata operations
* Security-sensitive validation
* API response consistency

Backend calculations are authoritative.

### Database and Services

Supabase will provide:

* Authentication
* Postgres database
* Row Level Security
* Vault for BYOK storage
* Storage for receipts and invoices

Supabase Postgres is the source of truth for business data.

### Hosting

The initial deployment target is:

* Bunny Magic Containers

The system must be deployable to local development, staging/review, and production environments.

---

## 3. Constitution Compliance Check

This plan complies with the project constitution as follows:

### Product Focus

The plan supports only:

* Income
* Expenses
* Categories
* Remaining-balance budgeting
* Receipts
* Invoices
* Reports
* AI extraction
* Settings
* Authentication
* Workspaces
* Security
* Financial accuracy
* History tracking

No bank sync, billing, investment, tax, payroll, or full accounting features are included.

### Manual-First Rule

The MVP works without AI.

Users can manually:

* Add income
* Add expenses
* Manage categories
* Upload invoices and receipts
* Attach files
* View reports
* Use personal workspaces
* Use team workspaces
* Manage settings

### AI-Optional Rule

AI features require BYOK.

AI is limited to:

* Receipt and invoice extraction
* Category suggestion
* Duplicate detection
* Spending summaries
* Spending analysis based only on authorized workspace data

AI results must remain draft, pending, or reviewable until confirmed by the user.

### Financial Accuracy Rule

Financial totals must use confirmed records only.

Draft, pending, failed, or unconfirmed AI extraction records must not affect:

* Income totals
* Expense totals
* Reports
* Remaining balance

Money values must not rely on floating-point arithmetic.

### Tenant Isolation Rule

Every business record must belong to a workspace.

Users must never access workspace data unless they are authorized members.

Role permissions must be enforced by backend validation and database-level controls where applicable.

---

## 4. High-Level Architecture

The system will use a monolith repository with clear internal boundaries.

### Application Flow

1. User signs in through Supabase Auth.
2. User enters a personal or team workspace.
3. Frontend sends authenticated requests to FastAPI.
4. FastAPI validates the user session and workspace access.
5. FastAPI reads or writes business data in Supabase Postgres.
6. Supabase RLS protects tenant-owned data.
7. Private invoice and receipt files are stored in Supabase Storage.
8. BYOK secrets are stored using Supabase Vault.
9. AI extraction runs only when the workspace has a valid configured AI key.
10. AI extraction results are saved as draft or pending records.
11. User reviews and confirms AI results.
12. Confirmed records affect financial totals and reports.

### Main System Boundaries

The project should be separated into these internal domains:

* Authentication and user session
* Workspace and membership
* Income management
* Expense management
* Category management
* Budget and financial calculations
* Receipt and invoice files
* AI extraction and review
* Reports and summaries
* Settings
* History tracking
* Deployment and operations

---

## 5. Repository Structure Plan

The repository must remain a monolith.

Recommended high-level structure:

* `apps/web`
  Next.js frontend application.

* `apps/api`
  FastAPI backend application.

* `packages/shared`
  Shared types, validation contracts, constants, and documentation references where useful.

* `supabase`
  Database migrations, RLS policy files, seed data, and storage policy notes.

* `specs`
  Product specs, feature specs, plans, task files, and constitution references.

* `docs`
  Practical documentation for setup, deployment, architecture, and decisions.

* `infra`
  Deployment configuration and environment notes.

* `tests`
  Cross-application testing strategy and test documentation where applicable.

The exact folder structure may be refined during task planning, but the monolith boundary must remain.

---

## 6. Data Model Plan

The data model must support workspace-based multi-tenancy from the beginning.

### Core Entities

The MVP data model should include the following conceptual entities:

#### Users

Managed through Supabase Auth.

Application-specific user profile data may be stored separately if needed.

#### Workspaces

A workspace represents a tenant.

Workspace types:

* Personal
* Team

Every business record belongs to a workspace.

#### Workspace Members

Membership links users to workspaces.

Required roles:

* Owner
* Admin
* Member
* Viewer

Role permissions must control access to workspace actions.

#### Income Records

Income records represent confirmed money coming into a workspace.

Required behavior:

* Income affects remaining balance only when confirmed.
* Income belongs to one workspace.
* Income is created by a user.
* Income can be edited or deleted according to permissions.
* Edits and deletions must update totals.

#### Expense Records

Expense records represent confirmed money spent by a workspace.

Required behavior:

* Expenses affect remaining balance only when confirmed.
* Expenses belong to one workspace.
* Expenses may belong to a category.
* Expenses may link to a receipt or invoice file.
* Expenses may originate from manual entry or confirmed AI extraction.
* Edits and deletions must update totals.

#### Categories

Categories organize expenses.

Required behavior:

* Categories belong to a workspace.
* Default categories should be available for Saudi-first usage.
* Users may create, rename, archive, and reorder categories.
* Categories explain spending but do not replace the remaining-balance model.

#### Files

Files represent uploaded receipts and invoices.

Required behavior:

* Files belong to a workspace.
* Files are private by default.
* Files may link to an expense.
* Files may be deleted based on user action or auto-delete settings.
* File metadata may remain for history and traceability.

#### AI Settings

AI settings define whether a workspace has BYOK configured.

Required behavior:

* Gemini and OpenAI should be supported as provider options.
* API keys must be stored securely using Supabase Vault.
* API keys must never be exposed to the frontend after saving.
* Manual workflows must work without AI settings.

#### AI Extraction Jobs

Extraction jobs represent receipt or invoice processing.

Required statuses should cover:

* Pending
* Processing
* Completed
* Failed
* Confirmed
* Cancelled

AI extraction output must not affect financial totals until the user confirms it.

#### Reports

Reports may be generated dynamically from confirmed records.

Stored report snapshots are not required for MVP unless explicitly specified later.

#### Settings

Settings may exist at user or workspace level.

Required settings include:

* Language preference
* Workspace defaults
* Auto-delete-after-extraction preference
* AI provider preference where applicable

#### History Activity

History tracking should support practical traceability.

History may include:

* Record created
* Record updated
* Record deleted
* File uploaded
* File deleted
* AI extraction started
* AI extraction completed
* AI extraction failed
* AI draft confirmed
* Workspace member changed
* Settings changed

History must not become a full accounting ledger in the MVP.

---

## 7. Permission Model Plan

Permissions must be enforced by role and workspace membership.

### Owner

Can:

* Manage workspace settings
* Manage members
* Manage income
* Manage expenses
* Manage categories
* Upload and delete files
* Configure AI settings
* View reports
* View history

### Admin

Can:

* Manage income
* Manage expenses
* Manage categories
* Upload and delete files
* View reports
* View history
* Manage normal workspace operations

Admin permissions may exclude ownership-level destructive actions.

### Member

Can:

* Add income if allowed by workspace policy
* Add expenses
* Upload receipts and invoices
* View shared dashboard
* View reports
* Edit own records where allowed

### Viewer

Can:

* View dashboard
* View confirmed records
* View reports

Viewer must not:

* Create records
* Edit records
* Delete records
* Manage files
* Manage members
* Configure AI settings

---

## 8. Financial Calculation Plan

Financial calculations must be centralized in the backend.

### Core Calculation

The core formula is:

> Remaining Balance = Confirmed Total Income - Confirmed Total Expenses

### Calculation Requirements

The backend must calculate:

* Confirmed total income by workspace and period
* Confirmed total expenses by workspace and period
* Remaining balance by workspace and period
* Category totals by period
* Merchant totals where merchant data exists
* Daily or monthly spending trends
* Team activity summaries
* Pending invoice review counts

### Reconciliation Rule

Report aggregations (income vs. expenses, remaining balance, category
breakdown, spending trend, top merchants, team activity, pending review
count) reuse the dashboard's confirmed-only calculation functions verbatim
rather than re-querying totals independently. Report totals for a workspace
and period must therefore always equal the dashboard's totals for the same
workspace and equivalent period.

### Financial State Rules

Only confirmed records affect totals.

The following must not affect totals:

* Draft AI extraction results
* Pending extraction results
* Failed extraction results
* Cancelled extraction results
* Deleted records
* Unconfirmed review suggestions

Deleted financial records must be excluded from active totals while preserving enough history for traceability.

### Money Handling

Money values must be stored and calculated using integer minor units or fixed-precision decimals.

Floating-point arithmetic must not be used for financial correctness.

SAR is the default MVP currency.

Currency fields may exist for future extensibility, but complex multi-currency behavior is not part of MVP.

---

## 9. API Plan

The FastAPI backend should expose clear API boundaries grouped by product domain.

### API Domains

The backend should provide API behavior for:

* Authentication/session validation
* Workspaces
* Workspace members
* Income
* Expenses
* Categories
* Files
* AI settings
* AI extraction jobs
* Reports
* Settings
* History

### API Requirements

Every protected API action must:

* Validate the authenticated user
* Validate workspace membership
* Validate role permission
* Validate input
* Avoid leaking sensitive data
* Return consistent errors
* Preserve financial correctness
* Respect tenant isolation

### History API Behavior

The history endpoint is forward-only: it records activity starting from
when history tracking shipped (Phase 9) and never backfills events from
before that point. Reading history is restricted to the Owner and Admin
roles; Member and Viewer requests are denied.

### API Response Principles

Responses should be:

* Predictable
* Minimal
* Safe
* Frontend-friendly
* Consistent across domains

API responses must not expose:

* Raw API keys
* Internal service secrets
* Private storage tokens beyond what is required for authorized access
* Stack traces
* Sensitive implementation details

---

## 10. Frontend Implementation Plan

The frontend must be built around the user's primary financial workflow.

### Main Screens

The MVP frontend should include:

1. Authentication screens
2. Workspace selector
3. Dashboard
4. Add income
5. Add expense
6. Expense history
7. Category management
8. Receipt and invoice upload
9. AI extraction review
10. Reports
11. Settings
12. Team workspace members
13. Basic history/activity view

### Dashboard Priorities

The dashboard must clearly show:

* Remaining balance
* Total income
* Total expenses
* Current period
* Top categories
* Recent expenses
* Pending invoice review count
* Quick actions for income, expense, and upload

### UX Rules

The frontend must be:

* Simple
* Fast
* Responsive
* Arabic-ready
* English-ready
* RTL-ready
* SAR-first
* Manual-entry friendly
* Clear when AI is unavailable
* Clear when AI output requires review

### Empty States

The UI must guide users when no data exists.

Required empty states:

* No income yet
* No expenses yet
* No categories yet
* No uploaded files yet
* No AI key configured
* No reports yet
* No team members yet

---

## 11. AI Integration Plan

AI must be optional and BYOK-based.

### Supported Providers

The MVP should support:

* Gemini
* OpenAI

The provider must be selected by the user or workspace owner/admin.

### BYOK Requirements

The system must allow authorized users to:

* Add an AI key
* Select provider
* Validate key where appropriate
* Replace key
* Remove key
* Use the app without any AI key

Stored keys must never be exposed to the frontend.

### AI Extraction Flow

The receipt/invoice extraction flow should be:

1. User uploads file.
2. File metadata is created.
3. User starts extraction or extraction starts automatically if configured.
4. Backend verifies workspace permission.
5. Backend verifies AI key availability.
6. Backend sends the document to the selected provider.
7. Backend receives structured extraction output.
8. System creates draft or pending result.
9. User reviews extracted data.
10. User confirms or edits the result.
11. Confirmed result becomes an expense.
12. If configured, file auto-delete behavior is applied.

### AI Extraction Fields

AI extraction should attempt to identify:

* Merchant name
* Invoice or receipt date
* Total amount
* VAT amount when available
* Currency
* Suggested category
* Description or summary
* Confidence level where possible

### AI Safety Rules

AI must not:

* Create final records automatically
* Override user decisions
* Access unauthorized workspace data
* Generate financial advice
* Expose sensitive data in logs
* Continue processing files that should be deleted by user settings

---

## 12. Storage Implementation Plan

Supabase Storage will store receipts and invoices.

### Storage Requirements

Files must be:

* Private by default
* Workspace-scoped
* Linked to file metadata
* Accessible only to authorized workspace members
* Protected from public access

### Supported Files

The MVP must support:

* Images
* PDFs

### Auto-Delete Behavior

Receipts and invoices are stored permanently by default.

The user must have a setting to auto-delete uploaded files after successful AI extraction.

The default auto-delete behavior should delete files only after successful extraction and user confirmation, unless the user explicitly enables deletion immediately after extraction.

If auto-delete is enabled:

* The original file may be deleted.
* Extracted structured data may remain.
* File metadata may remain.
* Failed extraction must not delete the file automatically.
* Pending review must not delete the file automatically unless explicitly configured.

---

## 13. Reports Implementation Plan

Reports must be simple and based only on confirmed records.

### Required MVP Reports

The MVP should support:

* Income vs expenses
* Remaining balance trend
* Category breakdown
* Daily or monthly spending trend
* Top merchants when available
* Recent expenses
* Team activity summary
* Pending invoice review summary

### Report Rules

Reports must:

* Use backend calculations
* Respect workspace permissions
* Exclude draft AI results
* Exclude deleted records
* Match dashboard totals
* Be understandable for non-accounting users

### AI Summaries

If AI is enabled, the system may generate spending summaries.

AI summaries must:

* Use only authorized workspace data
* Be based only on confirmed records unless explicitly summarizing pending items
* Avoid financial advice
* Prefer plain language
* Support Arabic and English where possible

---

## 14. History Tracking Plan

The MVP must support practical history tracking.

### Trackable Events

History may include:

* Income created
* Income updated
* Income deleted
* Expense created
* Expense updated
* Expense deleted
* Category created
* Category updated
* Category archived
* File uploaded
* File deleted
* AI extraction started
* AI extraction completed
* AI extraction failed
* AI draft confirmed
* Workspace member added
* Workspace member removed
* Role changed
* Setting changed

### History Rules

History exists for traceability and user clarity.

History must not become:

* A full accounting ledger
* Audit-grade compliance system
* Enterprise activity monitoring system

---

## 15. Testing Plan

Testing must focus on security, financial accuracy, and core user flows.

### Required Test Areas

Every major feature must be tested for:

* Authentication
* Workspace access
* Role permissions
* Income calculations
* Expense calculations
* Remaining balance accuracy
* File upload
* File privacy
* AI key security
* AI extraction review
* Auto-delete behavior
* Arabic UI behavior
* English UI behavior
* RTL layout behavior
* Tenant isolation

### Financial Accuracy Tests

Tests must verify:

* Adding income increases confirmed income totals.
* Adding expense increases confirmed expense totals.
* Remaining balance equals confirmed income minus confirmed expenses.
* Editing income recalculates totals.
* Editing expense recalculates totals.
* Deleting income recalculates totals.
* Deleting expense recalculates totals.
* Draft AI results do not affect totals.
* Failed extraction results do not affect totals.
* Deleted records do not affect active totals.
* Multiple workspaces remain financially isolated.

### Security Tests

Tests must verify:

* Users cannot access workspaces they do not belong to.
* Viewers cannot modify workspace records.
* Members cannot perform owner-only actions.
* Private files are not publicly accessible.
* API keys are never exposed to the frontend.
* Backend rejects unauthorized protected actions.
* Database policies prevent unauthorized tenant access where applicable.

### AI Tests

Tests must verify:

* App works without AI key.
* Invalid AI key produces a safe error.
* Provider failure produces a safe error.
* Extraction result remains pending until confirmed.
* Confirmed extraction creates or updates an expense correctly.
* Auto-delete setting is respected.
* AI summaries use only authorized workspace data.

---

## 16. Deployment Plan

The MVP will be prepared for deployment on Bunny Magic Containers.

### Deployment Environments

The project should support:

* Local development
* Staging or review
* Production

### Deployment Requirements

Deployment must include:

* Frontend service configuration
* Backend service configuration
* Supabase environment configuration
* Environment variables
* Production domain configuration
* Storage configuration
* Vault configuration
* Database migration process
* RLS policy setup
* Basic logging
* Backup notes
* Release checklist

### Environment Rules

Sensitive values must not be committed to the repository.

Production secrets must be stored securely.

Local development must not depend on production secrets.

---

## 17. Sequential Implementation Phases

Implementation must proceed in controlled phases.

### Phase 1 — Foundation and Repository Setup

Goals:

* Establish monolith repository
* Add frontend app boundary
* Add backend app boundary
* Add Supabase folder boundary
* Add documentation and specs structure
* Add environment documentation
* Confirm local development setup

Exit criteria:

* Repository structure is ready.
* Frontend and backend boundaries are clear.
* Spec and documentation locations are clear.
* Environment setup is documented.

### Phase 2 — Supabase Auth and Workspace Foundation

Goals:

* Configure authentication
* Create workspace model
* Create membership model
* Create default personal workspace behavior
* Support minimal team workspace
* Define role permissions
* Add tenant isolation policies

Exit criteria:

* Users can authenticate.
* Users can access their personal workspace.
* Users can create or access team workspaces.
* Workspace membership and roles are enforced.

### Phase 3 — Income, Expense, and Category Core

Goals:

* Implement income records
* Implement expense records
* Implement categories
* Implement confirmed record states
* Implement create, edit, delete behavior
* Implement financial recalculation rules

Exit criteria:

* Users can manually manage income and expenses.
* Categories can be managed.
* Confirmed records affect totals.
* Deleted and draft records do not affect totals.

### Phase 4 — Backend Financial Calculations and Dashboard Data

Goals:

* Implement authoritative backend calculations
* Provide dashboard data
* Calculate remaining balance
* Calculate income and expense totals
* Calculate category breakdown
* Calculate recent activity

Exit criteria:

* Dashboard data is correct.
* Remaining balance is authoritative.
* Backend and reports use the same calculation rules.

### Phase 5 — Frontend Core Experience

Goals:

* Build authentication UI
* Build workspace selector
* Build dashboard
* Build income forms
* Build expense forms
* Build category UI
* Build reports UI
* Build settings UI
* Add Arabic and English readiness
* Add RTL readiness

Exit criteria:

* User can use core product manually.
* App is useful without AI.
* Dashboard clearly shows remaining balance.

### Phase 6 — Receipt and Invoice Storage

Goals:

* Add file upload workflow
* Store receipts and invoices privately
* Link files to workspace metadata
* Link files to expenses where applicable
* Add file deletion behavior
* Add auto-delete setting

Exit criteria:

* Users can upload images and PDFs.
* Files are private.
* Files are linked to records.
* Auto-delete setting is available.

### Phase 7 — BYOK AI Settings

Goals:

* Add AI settings UI
* Support Gemini/OpenAI provider selection
* Store API keys securely
* Allow key replacement and removal
* Ensure AI key is never exposed to frontend
* Ensure manual app usage remains unaffected

Exit criteria:

* Authorized users can configure BYOK.
* App works without BYOK.
* Stored keys are secure.

### Phase 8 — AI Extraction and Review

Goals:

* Add extraction job workflow
* Process uploaded receipts and invoices
* Save extraction output as pending/draft
* Build review screen
* Allow user confirmation and correction
* Convert confirmed extraction to expense
* Respect auto-delete settings
* Handle provider errors safely

Exit criteria:

* AI extraction works when BYOK is configured.
* Results require user confirmation.
* Confirmed results affect totals.
* Unconfirmed results do not affect totals.

### Phase 9 — Reports, Summaries, and History

Goals:

* Finalize MVP reports
* Add spending summaries
* Add basic history/activity tracking
* Add team activity summary
* Add pending review summary
* Add optional AI spending summaries if BYOK is enabled

Exit criteria:

* Reports are clear and consistent.
* History provides practical traceability.
* AI summaries are optional and safe.

### Phase 10 — Testing, Security Review, and Deployment

Goals:

* Complete financial accuracy testing
* Complete tenant isolation testing
* Complete role permission testing
* Complete file privacy testing
* Complete AI behavior testing
* Complete Arabic/English UI testing
* Prepare production deployment
* Deploy to Bunny Magic Containers

Exit criteria:

* MVP is ready for review.
* No known tenant isolation issues remain.
* No known financial calculation issues remain.
* Production deployment is documented and repeatable.

---

## 18. Risk Plan

### Risk: Scope Creep

The product may drift into banking, accounting, payments, or enterprise workflows.

Mitigation:

* Enforce constitution scope.
* Reject features outside MVP boundaries.
* Keep each feature spec focused.

### Risk: Financial Calculation Errors

Incorrect totals would break user trust.

Mitigation:

* Centralize calculations in backend.
* Test all create, edit, delete, draft, and confirmed states.
* Use safe money storage and calculation methods.

### Risk: Tenant Isolation Failure

Users may access another workspace's data if isolation is weak.

Mitigation:

* Workspace-scope every business record.
* Validate membership and role in backend.
* Use Supabase RLS for tenant-owned data.
* Test unauthorized access paths.

### Risk: AI Extraction Inaccuracy

Receipts and invoices may be extracted incorrectly.

Mitigation:

* Store AI results as drafts or pending records.
* Require user confirmation.
* Show editable review screen.
* Never let unconfirmed AI results affect totals.

### Risk: BYOK Confusion

Users may not understand AI key setup.

Mitigation:

* Make AI optional.
* Explain that manual use works without AI.
* Provide clear settings UI.
* Show safe errors for invalid keys.

### Risk: File Privacy

Financial documents may be exposed if storage is misconfigured.

Mitigation:

* Use private storage.
* Avoid public file URLs.
* Scope file access by workspace membership.
* Test file access permissions.

---

## 19. Implementation Boundaries

The implementation must not include:

* Bank connections
* Payment gateway
* Subscription billing
* Investment tracking
* Debt management
* Payroll
* Tax filing
* Full accounting ledger
* Enterprise permission system
* Advanced accounting reconciliation
* Complex multi-currency behavior
* Public file access for financial documents
* AI-created final records without user confirmation

Any feature outside the constitution scope must be deferred.

---

## 20. Definition of Done

The MVP is considered complete when:

* Users can register and sign in.
* Users have a personal workspace.
* Users can use a minimal team workspace.
* Role permissions work.
* Users can add income.
* Users can add expenses.
* Users can manage categories.
* Users can upload receipts and invoices.
* Users can store files privately.
* Users can enable auto-delete-after-extraction.
* Users can view remaining balance.
* Users can view reports.
* Users can use the app fully without AI.
* Users can configure BYOK for Gemini/OpenAI.
* AI extraction creates reviewable results.
* Confirmed AI results become expenses.
* Unconfirmed AI results do not affect totals.
* Financial calculations are tested.
* Tenant isolation is tested.
* File privacy is tested.
* API keys are not exposed.
* Arabic and English readiness is present.
* RTL readiness is present.
* The app is deployable to Bunny Magic Containers.
* No MVP-excluded features are implemented.

---

## Final Implementation Direction

Build the product in this order:

1. Secure tenant foundation
2. Manual income and expense tracking
3. Authoritative financial calculations
4. Clear dashboard and reports
5. Private receipt and invoice storage
6. Optional BYOK AI extraction
7. Review-before-confirmation workflow
8. Testing and deployment

The implementation must protect the core experience:

> Add income. Add expenses. Upload invoices. Use AI only when desired. See exactly what remains.

---

## Next Step

This document is the master implementation plan. It does not replace the
per-feature Spec-Kit cycle required by the project constitution — each
phase in Section 17 must still go through its own `/speckit-specify` →
`/speckit-plan` → `/speckit-tasks` → `/speckit-implement` cycle before any
code, migrations, or tasks are created.

**The next step is to run `/speckit-specify` for `001-foundation`**,
covering Phase 1 — Foundation and Repository Setup.
