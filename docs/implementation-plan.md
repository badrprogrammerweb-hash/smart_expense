# Smart Expense - AI Implementation Plan

## Plan Metadata

**Project:** Smart Expense - AI
**Domain:** smartexpense.ai
**Plan Type:** Spec-Kit Implementation Plan
**Version:** 2.0.0
**MVP Status:** Phases 1–10 complete; ready for staging
**Roadmap Status:** Post-MVP design and product expansion in progress
**Current Phase:** Phase 11 — Design Discovery and UX Planning
**Architecture:** Monolith repository
**Primary Market:** Saudi-first
**Core Model:** Income-driven decreasing balance budgeting
**AI Model:** Optional BYOK using Gemini or OpenAI
**Deployment Target:** Bunny Magic Containers
**Constitution:** Must comply with `.specify/memory/constitution.md` version 2.0.0

---

## 1. Executive Summary

Smart Expense - AI is a Saudi-first, multi-tenant SaaS application for tracking income, expenses, receipts, invoices, and remaining balance.

The completed MVP supports individuals, families, couples, and small teams. It works fully without AI. AI features are optional and require the user to provide their own Gemini or OpenAI key.

The product is centered on one core financial question:

> How much income came in, how much was spent, and how much remains?

The primary financial formula is:

> Remaining Balance = Confirmed Total Income - Confirmed Total Expenses

The completed MVP excludes bank connections, payment processing,
subscription billing, paid feature tiers, full accounting features, payroll,
tax features, investment tracking, and enterprise-grade workflows.

A post-MVP optional product-support purchase flow is planned for Phase 17.
It will not unlock features, increase limits, or restrict non-supporting
users.

---

## 2. Technical Context

### Frontend

The frontend is built using:

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
* Arabic RTL interface in the current MVP
* Full Arabic and English localization planned for Phase 12
* Saudi Riyal as the default workspace currency
* One configurable base currency per workspace planned for Phase 12

The frontend must not be the source of truth for financial calculations or permissions.

Frontend calculations may be used only for display previews and must never override backend or database truth.

### Backend

The backend is built using:

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

No bank sync, mandatory subscription billing, paid feature tiers,
investment, tax, payroll, or full accounting features are included.

Optional one-time product-support purchases are planned only for Phase 17.

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

AI extraction results must remain non-final until confirmed by the user.
Successful extraction output is stored as `ready_for_review`; failed and
discarded results must never affect financial totals.

### Financial Accuracy Rule

Financial totals must use confirmed records only.

Processing, ready-for-review, failed, discarded, or otherwise unconfirmed
AI extraction records must not affect:

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
10. AI extraction starts as `processing` and becomes `ready_for_review` or `failed`.
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

Post-MVP required behavior planned for Phase 12:

* Each workspace will have exactly one base currency.
* Saudi Riyal will remain the default currency.
* Workspace records, dashboard totals, and reports will use the workspace base currency.
* Mixed-currency records, exchange-rate conversion, and complex multi-currency accounting remain out of scope.

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

Categories currently organize expense records using a flat category
structure.

Current behavior:

* Categories belong to a workspace.
* Expense records may be linked to one category.
* Existing records preserve their category links.
* Categories may be created, renamed, and archived according to permissions.
* Archived categories remain identifiable in historical records.

Post-MVP required behavior planned for Phase 13:

* Income and expense category trees will remain separate.
* Categories will support one parent-child level.
* A category may be a main category or a subcategory.
* System categories may have Arabic and English translated names.
* User-created categories will retain the name entered by the user.
* Disabled categories will remain visible in historical records.
* Existing category links must be migrated safely without losing historical meaning.

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

Required statuses are:

* Processing
* Ready for review
* Failed
* Confirmed
* Discarded

The persisted database values are:

* `processing`
* `ready_for_review`
* `failed`
* `confirmed`
* `discarded`

AI extraction output must not affect financial totals until the user confirms it.

#### Reports

Reports may be generated dynamically from confirmed records.

Stored report snapshots are not required for MVP unless explicitly specified later.

#### Settings

Settings may exist at user or workspace level.

Current settings include:

* Workspace defaults
* Auto-delete-after-extraction preference
* AI provider preference where applicable

Post-MVP settings planned for Phase 12 include:

* User language preference
* Workspace base currency

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

* Add and manage permitted expense records
* Upload receipts and invoices
* View the shared dashboard
* View reports and history
* Configure permitted AI settings

Must not:

* Add or manage income
* Manage workspace members
* Perform ownership-level actions

### Viewer

Can:

* View dashboard
* View confirmed records
* View reports
* View history

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

Only confirmed income and expense records affect financial totals.

AI extraction records never affect totals directly. The following extraction
states must not affect totals:

* `processing`
* `ready_for_review`
* `failed`
* `discarded`

When an extraction is confirmed, only the resulting confirmed expense affects
financial totals.

Deleted income and expense records must be excluded from active totals while
preserving enough history for traceability.

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
when history tracking shipped in Phase 9 and does not backfill earlier
events.

Reading history is allowed for Owner, Admin, Member, and Viewer roles.
History is read-only and append-only for all roles.

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
* Arabic RTL as the current primary interface
* Full Arabic and English localization planned for Phase 12
* Complete RTL/LTR layout switching planned for Phase 12
* Workspace-currency-aware financial formatting planned for Phase 12
* Hierarchical category selection planned for Phase 13
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

The provider may be selected by an authorized Owner, Admin, or Member.
Viewers have read-only access and must not configure AI settings.

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
3. User explicitly starts extraction for an uploaded file.
4. Backend verifies workspace permission.
5. Backend verifies AI key availability.
6. Backend sends the document to the selected provider.
7. Backend receives structured extraction output.
8. System stores successful output as `ready_for_review`; unsuccessful
processing becomes `failed`.
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

The completed MVP supports:

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
* Processing, ready-for-review, failed, and discarded extraction results do not affect totals.
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

The completed MVP supports practical history tracking.

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
* Applicable Arabic and English UI behavior
* Applicable RTL and LTR layout behavior
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
* A successful extraction remains `ready_for_review` until confirmed or discarded.
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

### Phase 1 — Foundation and Repository Setup — Completed

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

### Phase 2 — Supabase Auth and Workspace Foundation — Completed

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

### Phase 3 — Income, Expense, and Category Core — Completed

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
* Deleted records do not affect totals.

### Phase 4 — Backend Financial Calculations and Dashboard Data — Completed

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

### Phase 5 — Frontend Core Experience — Completed

Goals:

* Build authentication UI
* Build workspace selector
* Build dashboard
* Build income forms and history
* Build expense forms and history
* Build category UI
* Build settings UI
* Establish an Arabic-first frontend foundation
* Establish RTL-ready layouts and reusable frontend patterns

Exit criteria:

* Users can complete the core manual financial workflow.
* The application is fully usable without AI.
* The dashboard clearly shows the remaining balance.
* The current interface supports Arabic RTL usage.
* Full Arabic/English localization and RTL/LTR switching are deferred to Phase 12.

### Phase 6 — Receipt and Invoice Storage — Completed

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

### Phase 7 — BYOK AI Settings — Completed

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

### Phase 8 — AI Extraction and Review — Completed

Goals:

* Add extraction job workflow
* Process uploaded receipts and invoices
* Save successful extraction output as `ready_for_review` and unsuccessful processing as `failed`
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

### Phase 9 — Reports, Summaries, and History — Completed

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

### Phase 10 — Testing, Security Review, and Deployment Readiness — Completed

Goals:

* Complete financial accuracy testing
* Complete tenant isolation testing
* Complete role permission testing
* Complete file privacy testing
* Complete AI behavior testing
* Complete Arabic RTL UI testing
* Prepare staging and production deployment for Bunny Magic Containers
* Document the repeatable deployment process

Exit criteria:

* MVP is ready for staging deployment.
* Deployment configuration and procedures are documented and repeatable.
* No known tenant isolation issues remain.
* No known financial calculation issues remain.

### Phase 11 — Design Discovery and UX Planning

Goals:

* Finalize the product design brief
* Create and review the visual design system
* Build an Arabic RTL interactive prototype
* Review all existing MVP screens
* Identify post-MVP product improvements
* Document responsive, accessibility, and RTL requirements
* Produce a developer-ready design handoff

Exit criteria:

* The design system is visually consistent.
* Existing MVP screens are represented in the prototype.
* Arabic RTL behavior is reviewed.
* Desktop and mobile requirements are documented.
* No production code or backend behavior is changed.
* Post-MVP improvements are separated into dedicated phases.

### Phase 12 — Internationalization and Workspace Currency

Goals:

* Add Arabic and English interface support
* Support complete RTL and LTR layout switching
* Store the preferred interface language per user
* Add one base currency per workspace
* Format money, numbers, and dates according to language and currency
* Keep Saudi Riyal as the default currency
* Update frontend, backend contracts, and tests where required

Exit criteria:

* Users can switch between Arabic and English.
* Arabic uses RTL and English uses LTR correctly.
* Each workspace has exactly one base currency.
* Currency formatting is consistent across records, dashboard, reports, AI review, and history.
* Existing financial calculations remain accurate.
* No exchange-rate conversion or mixed-currency accounting is introduced.

### Phase 13 — Hierarchical Categories

Goals:

* Add main categories and one level of subcategories
* Separate income categories from expense categories
* Expand the default category catalog
* Allow users to create, edit, disable, and organize categories
* Preserve categories linked to historical records
* Update income, expense, reports, and AI extraction flows
* Support translated names for system-provided categories

Exit criteria:

* Records can use a main category and a subcategory.
* Income and expense category trees remain separate.
* Existing category data is migrated safely.
* Disabled categories remain visible in historical records.
* Reports can summarize by main category and drill into subcategories.
* AI extraction can suggest supported subcategories without auto-confirming records.

### Phase 14 — Design System and UI Refresh Implementation

Goals:

* Implement the approved design system in the existing Next.js frontend
* Apply the redesigned Arabic and English layouts
* Update desktop, tablet, and mobile experiences
* Standardize forms, tables, cards, dialogs, navigation, and states
* Resolve the F-001 RTL date display issue
* Preserve existing APIs, permissions, and financial rules
* Complete visual regression, accessibility, and end-to-end testing

Exit criteria:

* The approved design is implemented across all MVP screens.
* Arabic RTL and English LTR layouts work correctly.
* Desktop and mobile experiences are consistent.
* F-001 is resolved and tested.
* Existing business logic and permissions remain unchanged.
* Frontend, backend, and end-to-end test suites pass.

### Phase 15 — Progressive Web App and Mobile Readiness

Goals:

* Make the responsive web application installable as a PWA
* Add application icons, manifest, and mobile launch experience
* Improve mobile navigation and touch interactions
* Support receipt capture and upload from mobile devices
* Define safe offline and reconnect behavior
* Prepare the frontend and API contracts for future app-store packaging

Exit criteria:

* The application can be installed on supported mobile devices.
* Core workflows are usable on small screens.
* Receipt upload works from mobile files or camera where supported.
* Offline behavior never creates incorrect financial totals or duplicate records.
* Existing security and workspace isolation remain intact.

### Phase 16 — Free Mobile Application

Goals:

* Package or build the approved mobile experience for Android and iOS
* Reuse the existing backend and Supabase authentication
* Support core financial, file upload, AI review, report, and settings flows
* Complete mobile security, accessibility, and store-readiness testing
* Keep the application free to use

Exit criteria:

* Core web features are available on mobile.
* Arabic RTL and English LTR work correctly.
* Financial calculations remain backend-authoritative.
* Mobile uploads and AI review are reliable.
* No paid feature tier is introduced.


### Phase 17 — Optional Product Support Purchases

Goals:

* Add an optional product-support purchase experience
* Offer one-time symbolic digital support items
* Keep the complete product free for every user
* Use hosted checkout for supported web purchases
* Use Apple In-App Purchase and Google Play Billing in store apps
* Provide clear success, failure, refund, and receipt states
* Keep support transactions separate from workspace financial records
* Avoid charitable or donation terminology

Exit criteria:

* Users can optionally purchase a symbolic support item.
* Support purchases do not unlock features or change limits.
* Non-supporting users retain the complete product experience.
* Payment-card details are not stored by Smart Expense.
* Web and mobile payment flows comply with their platform requirements.
* Legal, commercial, tax, refund, and accounting requirements are reviewed
  before release.

### Platform and Financial Planning Notes

* Apple support purchases should use StoreKit In-App Purchase.
* Google Play support purchases should use Google Play Billing unless the
  current policy for the target storefront explicitly permits another method.
* Tax-exempt donation exceptions must not be assumed or used unless the
  project legally qualifies for that classification.
* The project may apply for the App Store Small Business Program when
  eligible.
* Store commissions, taxes, refund rules, and regional billing requirements
  must be verified immediately before implementation and release.
* Commission percentages must not be hard-coded into the product
  constitution or long-term business model.

---

## 18. Risk Plan

### Risk: Scope Creep

The product may drift into banking, accounting, payments, or enterprise workflows.

Mitigation:

* Enforce constitution scope.
* Reject features outside the approved constitution and current phase scope.
* Keep each feature spec focused.

### Risk: Financial Calculation Errors

Incorrect totals would break user trust.

Mitigation:

* Centralize calculations in backend.
* Test create, edit, delete, confirmed, and all AI extraction state transitions.
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

* Store AI results using the defined extraction states and require confirmation before creating expenses.
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

### Risk: Localization Regression

Arabic RTL and English LTR layouts may behave inconsistently.

Mitigation:

* Use centralized translation keys.
* Test both directions on every core screen.
* Isolate dates, emails, filenames, and technical identifiers.
* Prevent untranslated system text in production.

### Risk: Currency Configuration Errors

Changing or misconfiguring workspace currency may make financial values
unclear.

Mitigation:

* Allow exactly one base currency per workspace.
* Do not perform exchange-rate conversion.
* Require confirmation before changing an established workspace currency.
* Test formatting across dashboard, reports, history, and AI review.

### Risk: Category Migration Errors

Migrating flat categories into hierarchical categories may break historical
classification or reports.

Mitigation:

* Preserve existing category IDs and historical links.
* Use a safe migration strategy.
* Prevent deletion of referenced categories.
* Test report reconciliation before and after migration.


### Risk: UI Refresh Regression

Implementing the new design may unintentionally alter business flows or
permissions.

Mitigation:

* Treat the approved prototype as a visual reference, not new business logic.
* Preserve API contracts.
* Run existing regression and end-to-end tests.
* Add accessibility and visual regression checks.

---

## 19. Implementation Boundaries

The implementation must not include:

* Bank connections
* Paid feature tiers and mandatory subscription billing
* In-app storage or direct processing of payment-card details
* Monetization that restricts the free core product
* Investment tracking
* Debt management
* Payroll
* Tax filing
* Full accounting ledger
* Enterprise permission system
* Advanced accounting reconciliation
* Mixed-currency records, exchange-rate conversion, and complex multi-currency accounting
* Public file access for financial documents
* AI-created final records without user confirmation

Any feature outside the constitution scope must be deferred.

Optional one-time product-support purchases may be added in Phase 17.

They must not unlock features, change limits, alter permissions, create a
mandatory subscription, or be presented as charitable fundraising.

---

## 20. MVP Definition of Done — Achieved

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
* An Arabic-first RTL interface is present.
* Full Arabic and English localization is planned for Phase 12.
* Complete RTL and LTR layout switching is planned for Phase 12.
* The app is ready for staging deployment to Bunny Magic Containers.
* No MVP-excluded features are implemented.

---

## 21. Post-MVP Roadmap Definition of Done

Post-MVP expansion is complete when:

* Arabic and English interfaces are fully supported.
* RTL and LTR layouts work across all core screens.
* Each workspace has one base currency.
* Financial formatting respects workspace currency and interface locale.
* Income and expense categories support one subcategory level.
* Existing category history is preserved after migration.
* The approved design system is implemented on desktop and mobile.
* F-001 is resolved and regression-tested.
* Existing financial accuracy, permissions, and tenant isolation remain intact.
* The web application is installable as a PWA.
* Core mobile workflows work reliably on supported devices.
* Receipt capture and upload work from supported mobile devices.
* The free Android and iOS applications pass store-readiness validation.
* Optional product-support purchases remain separate from workspace financial records.
* Non-supporting users retain the complete product experience.
* Store, legal, tax, refund, and payment requirements are verified before release.

---

## Completed MVP Implementation Direction

The MVP was built in this order:

1. Secure tenant foundation
2. Manual income and expense tracking
3. Authoritative financial calculations
4. Clear dashboard and reports
5. Private receipt and invoice storage
6. Optional BYOK AI extraction
7. Review-before-confirmation workflow
8. Testing and deployment

## Post-MVP Implementation Direction

Continue development in this order:

1. Complete design discovery and handoff
2. Implement Arabic/English localization and workspace base currency
3. Implement hierarchical income and expense categories
4. Implement the approved design system and responsive UI refresh
5. Make the web application installable and mobile-ready
6. Release the free mobile application
7. Add optional one-time product-support purchases
8. Run complete regression, accessibility, security, store, and deployment validation

The implementation must protect the core experience:

> Add income. Add expenses. Upload invoices. Use AI only when desired. See exactly what remains.

---

## Next Step

Phases 1–10 are complete and merged into `main`. The MVP is ready for
staging.

The next step is Phase 11 — Design Discovery and UX Planning. This phase
documents and validates the visual direction without changing production
business logic.

After Phase 11 is approved, Phases 12–17 must each follow the project’s
required Spec-Kit cycle:

`/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → phase-by-phase `/speckit-implement` → review → tests → merge.
