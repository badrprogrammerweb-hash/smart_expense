<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0
Modified principles: N/A (no Core Principle I–XVI added, removed, or
  redefined)
Modified sections:
  - Technology Constraints → Frontend line: "Next.js 14" replaced with
    "Next.js 16.x (Active LTS), kept on the latest patched 16.x release"
    (security-driven amendment; see rationale below). React, Tailwind
    CSS, and Shadcn UI are unchanged. The Backend line ("Python,
    FastAPI") is unchanged — it carries no version pin and remains
    accurate; backend-specific version pins belong in
    specs/001-foundation/plan.md and research.md, not the constitution.
Added sections: none
Removed sections: none
Version bump rationale: MINOR, not MAJOR or PATCH. No Core Principle was
  added, removed, or redefined, so this is not MAJOR. The change is more
  than a wording/typo fix — it is a binding Technology Constraint change
  with a security rationale and an ongoing maintenance policy ("kept on
  the latest patched release") that did not exist before — so PATCH
  understates it. MINOR best fits "materially expanded guidance" within
  an existing section.
Amendment rationale: npm audit identified unresolved advisories against
  next@14.2.35 — the newest 14.x release that exists — including a high-
  severity SSRF via WebSocket upgrades (CVSS 8.6) and several Denial-of-
  Service issues. Next.js has stopped backporting security fixes to the
  14.x branch, so no in-line 14.x upgrade can resolve them. The project
  adopts the actively-patched 16.x LTS line instead, with an explicit
  policy to stay current on 16.x patches going forward.
Templates checked, no changes required:
  - .specify/templates/plan-template.md ✅ no project-specific version
    references found
  - .specify/templates/spec-template.md ✅ no project-specific version
    references found
  - .specify/templates/tasks-template.md ✅ no project-specific version
    references found
  - .specify/templates/commands/*.md — directory does not exist in this
    project; nothing to check
  - CLAUDE.md / AGENTS.md ✅ both only point to specs/001-foundation/
    plan.md for stack details; no direct version references to update
Follow-up TODOs:
  - specs/001-foundation/plan.md, research.md, data-model.md,
    tasks.md, and docs/implementation-plan.md still need their own
    Next.js/FastAPI/python-dotenv/Starlette/pip references updated for
    consistency with this amendment — tracked as a separate, immediate
    follow-up in this same session, not deferred.
-->

# Smart Expense - AI Constitution

## Project Identity

**Product:** Smart Expense - AI
**Domain:** smartexpense.ai
**Type:** Saudi-first, multi-tenant SaaS expense tracker and smart budgeting platform
**Users:** Individuals, families, couples, and small teams
**MVP Status:** Free, with no payment gateway or subscription billing
**Core Model:** Income-driven decreasing balance budgeting
**Architecture:** Monolith repository

## Core Principles

### I. Core Product Principle

Smart Expense - AI MUST stay focused on practical personal expense tracking
and smart budgeting. The product exists to answer one question clearly: how
much income came in, how much was spent, and how much remains. The MVP MUST
prioritize income tracking, expense tracking, category management,
remaining-balance budgeting, receipt and invoice uploads, optional AI
extraction, reports and summaries, personal and team workspaces, and secure
history tracking. The MVP MUST NOT become a general finance, accounting,
investment, banking, payroll, tax, or payment platform.

**Rationale:** A narrow, well-understood product surface keeps the MVP
shippable and keeps every feature decision answerable against one question.

### II. Budgeting Philosophy (Income-Driven Decreasing Balance)

The budgeting model MUST be income-driven and decreasing-balance based:
Remaining Balance = Confirmed Total Income − Confirmed Total Expenses.
Expenses from any category MUST reduce the same total income pool.
Categories explain spending behavior but MUST NOT replace the main
remaining-balance model. The dashboard MUST always make total income, total
expenses, remaining balance, top categories, recent expenses, and the
current period clear. Complex category-budgeting rules are deferred unless
explicitly specified later.

**Rationale:** A single, simple decreasing-balance formula is something
non-accountant users can verify in their head; layered category budgets
would obscure that clarity.

### III. MVP Scope Discipline

The MVP MUST include: authentication; personal workspace; minimal team
workspace; workspace roles; income records; expense records; category
management; receipt and invoice upload (images and PDFs); optional AI
extraction using BYOK; manual review before confirming AI extraction
results; reports and summaries; settings; SAR-first formatting; Arabic and
English UI readiness; permanent invoice storage by default; an
auto-delete-after-extraction setting; and basic history/activity tracking.

The MVP MUST exclude: bank connections; payment gateway; subscription
billing; investment tracking; debt management; payroll; tax filing; a full
accounting ledger; corporate card features; complex approval workflows;
complex multi-currency support; enterprise permission systems; and advanced
accounting reconciliation.

**Rationale:** Explicit inclusion/exclusion lists prevent scope creep into
adjacent, much larger product categories (accounting, banking, payroll).

### IV. Saudi-First Default

Smart Expense - AI IS Saudi-first. Defaults MUST include SAR as the primary
currency, Arabic and English UI readiness, RTL layout readiness,
Saudi-relevant expense categories, VAT-aware invoice extraction when
possible, and simple language for non-accounting users. Default categories
MUST include: Restaurants, Groceries, Fuel, Transportation, Rent,
Utilities, Internet & Mobile, Health, Education, Family, Shopping,
Entertainment, Travel, Subscriptions, Other. The product MUST be
understandable to users without accounting or finance backgrounds.

**Rationale:** The primary market and earliest users are Saudi-based;
defaults that fit them out of the box reduce onboarding friction.

### V. Manual-First, AI-Optional

The app MUST work fully without AI. Users without an AI key MUST still be
able to add income, add expenses, manage categories, upload invoices and
receipts, attach files to records, view reports, use personal and team
workspaces, and manage settings. AI features require the user to provide
their own Gemini or OpenAI key (BYOK). Allowed AI features are limited to:
receipt and invoice extraction, category suggestion, duplicate detection,
spending summaries, and spending analysis based only on authorized
workspace data. AI MUST NEVER create final financial records automatically.
AI extraction results MUST be saved as drafts, pending records, or
reviewable suggestions until the user confirms them. Unconfirmed AI results
MUST NOT affect income totals, expense totals, reports, or remaining
balance.

**Rationale:** AI is a convenience layer, not a dependency; the product
must remain trustworthy and usable for users who decline to share an AI
key or whose extraction fails.

### VI. Privacy and Security

Financial data, receipts, invoices, and AI keys are sensitive. The system
MUST enforce: workspace-based tenant isolation; role-based permissions;
private file storage by default; secure BYOK storage using Supabase Vault;
no API key exposure to the frontend; no sensitive data in logs; no
sensitive data in error messages; backend validation for all protected
actions; database-level access control where applicable; and Supabase Row
Level Security for tenant-owned data. Frontend checks alone are NEVER
sufficient for security — every protected action MUST be validated on the
backend or at the database policy level.

**Rationale:** Financial documents and credentials are high-value targets;
defense must not rely on a layer (the frontend) that is fully visible and
controllable by the client.

### VII. Workspace and Multi-Tenant Isolation

Every business record MUST belong to a workspace. The system MUST support
personal workspaces and minimal team workspaces, with roles: Owner, Admin,
Member, Viewer. Workspace-owned records include income, expenses,
categories, files, AI extraction jobs, reports, settings, members, and
activity history. Users MUST NEVER access data from workspaces they do not
belong to. Viewers MUST NOT modify workspace records. Team workspaces in
the MVP MUST remain simple — complex invitations, approvals, billing
seats, enterprise permissions, and ownership transfer workflows are
deferred unless explicitly specified later.

**Rationale:** Multi-tenant isolation is a correctness and trust
requirement, not a nice-to-have; simplicity in team features keeps the MVP
shippable without weakening isolation guarantees.

### VIII. Storage and File Retention

Receipts and invoices MUST be stored permanently by default. Users MUST
have configurable auto-delete behavior for uploaded files after AI
extraction. Supported file types are images and PDFs. If auto-delete is
enabled, the original file may be deleted only after successful
extraction; extracted structured data and file metadata MAY remain for
history and traceability. Failed extraction MUST NOT delete the file
automatically. Pending review MUST NOT delete the file automatically
unless the user explicitly configured that behavior. Storage MUST be
private by default; public file access MUST NOT be used for financial
documents. The default auto-delete behavior deletes files only after
successful extraction AND user confirmation, unless the user explicitly
enables deletion immediately after extraction.

**Rationale:** Receipts are often the only proof of a transaction; default
retention protects users from accidental data loss while still allowing
opt-in cleanup.

### IX. Architecture Authority

FastAPI owns calculation logic and backend service rules, including:
remaining balance calculations, income totals, expense totals, report
aggregation, workspace authorization, role validation, AI extraction
orchestration, duplicate detection, file metadata operations, and
security-sensitive validation. Supabase Postgres is the source of truth
for business data. The frontend MUST NOT be the source of truth for
financial calculations or permissions; frontend calculations may be used
only for display previews and MUST NOT override backend or database
truth.

**Rationale:** Centralizing calculation and authorization logic in the
backend prevents drift between what the UI shows and what is actually
true and authorized.

### X. Financial Accuracy (NON-NEGOTIABLE)

Money values MUST NEVER be calculated using floating-point arithmetic;
amounts MUST be stored using integer minor units or fixed-precision
decimals. SAR is the default currency for the MVP. Remaining balance MUST
always equal confirmed total income minus confirmed total expenses. Draft,
pending, failed, or unconfirmed AI extraction records MUST NOT affect
financial totals. Editing or deleting income or expenses MUST immediately
reflect in recalculated totals. Backend calculations are authoritative;
frontend totals are display-only and MUST NOT be trusted as source of
truth. Tests MUST cover: zero income, zero expenses, negative remaining
balance, deleted records, edited records, pending AI drafts, failed AI
extraction, multiple workspaces, and viewer access restrictions. A feature
that risks incorrect financial totals MUST NOT be shipped until the
calculation behavior is tested. Deleted financial records MUST be excluded
from active totals while preserving enough history for traceability.

**Rationale:** Incorrect financial totals destroy user trust immediately
and are the single hardest class of bug to recover credibility from;
floating-point money bugs are a well-known, avoidable failure mode.

### XI. Reports Integrity

Reports MUST explain user spending simply and MUST be based only on
confirmed records. MVP reports should include income vs. expenses,
remaining balance trend, category breakdown, daily or monthly spending
trend, top merchants when available, recent expenses, team activity
summary, and pending invoice review summary. Draft AI extraction results
MUST NOT appear as final spending until confirmed by the user.

**Rationale:** Reports built on unconfirmed data would mislead users about
their actual financial position.

### XII. History Tracking

The system MUST support practical history tracking — record created,
updated, deleted; file uploaded/deleted; AI extraction started, completed,
failed; AI draft confirmed; workspace member changed; settings changed —
without becoming a full accounting ledger, audit-grade financial system, or
enterprise compliance product in the MVP.

**Rationale:** Lightweight traceability gives users confidence and aids
debugging without taking on the scope and liability of a compliance-grade
audit system.

### XIII. Future Monetization Readiness

The MVP is free and MUST NOT include payment processing or any billing
flow. The architecture SHOULD remain ready for future free/Pro/Team plans,
storage limits, AI usage limits, workspace member limits, invoice upload
limits, and premium reports, but no payment provider integration may be
added in the MVP.

**Rationale:** Designing with future monetization hooks in mind avoids
costly rework later, without distracting the MVP with billing complexity
now.

### XIV. Testing Requirements

Every major feature MUST be tested for: authentication; workspace access;
role permissions; income and expense calculations; remaining balance
accuracy; file upload and privacy; AI key security; AI extraction review;
auto-delete behavior; Arabic and English UI behavior; RTL layout behavior;
and tenant isolation. Critical rules that MUST always be covered: AI
drafts must not affect totals until confirmed; editing or deleting income
or expenses must recalculate balance; users must not access another
workspace's data; viewers must not modify workspace records; private files
must not be publicly accessible; API keys must never be exposed to the
frontend. No implementation is complete until its security and financial
accuracy risks are tested.

**Rationale:** Security and financial-accuracy regressions are the
highest-cost failures for this product; testing them is treated as part of
"done," not an optional follow-up.

### XV. Scope Control

No feature may be added unless it directly supports income, expenses,
categories, remaining-balance budgeting, invoices, receipts, reports, AI
extraction, settings, authentication, workspaces, security, financial
accuracy, or history tracking. Features outside this scope MUST be
rejected or deferred. The MVP MUST prefer simple, reliable workflows over
complex financial automation. When in doubt, choose clarity, privacy, and
correctness over feature expansion.

**Rationale:** An explicit allow-list of feature categories is a stronger
guardrail against scope creep than a vague "stay focused" guideline.

### XVI. Spec-Kit Workflow

Development MUST follow this order: constitution, product specification,
feature specifications, technical plan, task breakdown, implementation,
testing, deployment. Implementation MUST NOT begin before the relevant
spec and plan exist. Each major feature MUST have its own focused
specification — the project MUST NOT be implemented from one large
all-in-one specification. Specs SHOULD be small enough to review, plan,
test, and implement safely.

**Rationale:** Small, sequenced specs keep planning reviewable and keep
implementation traceable back to an approved design decision.

## Technology Constraints

**Frontend:** Next.js 16.x (Active LTS), kept on the latest patched 16.x
release; React, Tailwind CSS, Shadcn UI.

**Backend:** Python, FastAPI.

**Database and services:** Supabase Auth, Supabase Postgres, Supabase
Vault, Supabase Storage.

**Workflow:** Monolith repository; Spec-Kit-driven planning;
AI-assisted development is allowed; generated code MUST be reviewed
before commit.

**Initial deployment target:** Bunny Magic Containers, unless changed by
a later deployment decision.

Tool-specific instructions, model names, and development assistant
routing belong in `CLAUDE.md` or development workflow documentation, not
in this constitution.

## Documentation and Scope Boundaries

Documentation MUST be kept practical and close to implementation.
Required documentation areas: project setup; environment variables;
Supabase setup; database schema overview; RLS policy overview; storage
policy overview; API overview; financial calculation rules; AI/BYOK
behavior; deployment notes. Documentation MUST NOT duplicate every
implementation detail — long implementation instructions belong in
feature specs, plans, or task files, not in the constitution.

This constitution MUST NOT contain: full database schema; full API
endpoint list; UI screen-by-screen specifications; detailed
implementation tasks; detailed deployment scripts; prompt chains; model
routing rules; tool-specific operating instructions; long user stories;
pricing tables; marketing copy; or future roadmap details beyond scope
boundaries. Those details belong in specs, plans, task files,
`CLAUDE.md`, or project documentation.

## Governance

This constitution may change only when the project direction changes.
Small implementation decisions MUST NOT modify the constitution. Before
changing this constitution, the change MUST be checked against: product
focus; financial accuracy; privacy; security; MVP scope; Saudi-first
requirements; and manual-first/AI-optional behavior. Any change that
expands the MVP scope MUST be treated as a deliberate product decision,
not an implementation convenience.

Amendments follow semantic versioning: MAJOR for backward-incompatible
governance or principle removals/redefinitions; MINOR for new principles
or materially expanded guidance; PATCH for clarifications and non-semantic
wording fixes. All PRs and reviews MUST verify compliance with this
constitution; complexity MUST be justified against it. Use `CLAUDE.md` for
runtime, tool-specific development guidance — it does not override this
constitution.

Smart Expense - AI MUST remain: Saudi-first; manual-first; AI-optional;
privacy-conscious; multi-tenant; financially accurate; simple to use; and
focused on income, expenses, invoices, receipts, reports, and remaining
balance. The core experience is: add income, add expenses, upload
invoices, use AI only when desired, see exactly what remains.

**Version**: 1.1.0 | **Ratified**: 2026-06-19 | **Last Amended**: 2026-06-21
