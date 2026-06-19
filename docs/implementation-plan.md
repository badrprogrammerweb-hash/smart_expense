# Smart Expense - AI — Master Implementation Roadmap

## Context

This repo started greenfield, with only the ratified project constitution
(`.specify/memory/constitution.md`, v1.0.0) and a configured Spec-Kit
toolchain in place. The constitution (Principle XVI) requires implementation
to proceed through small, per-feature specs — not one large all-in-one spec.

This document is the **master roadmap**: it records the agreed MVP scope,
the decisions made to resolve gaps in the original draft plan, and the phase
order implementation will follow. It is not itself a Spec-Kit `plan.md`.
Each phase below is implemented as its own Spec-Kit cycle:
`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`,
in order, with the constitution as the compliance gate for every phase.

## Decisions Locked In

| Topic | Decision |
|---|---|
| Planning workflow | This roadmap first; then one Spec-Kit cycle per phase/feature |
| Auto-delete default | OFF — files retained permanently unless user opts in (Constitution VIII) |
| Member role income permission | Fixed in code: Member can add expenses + upload files, **cannot** add income; no per-workspace toggle |
| Auth methods (MVP) | Email/password only via Supabase Auth; OAuth deferred |
| Team invites | Email invite link with an accept step (invite record → invitee accepts) |
| History visibility | All workspace members (Owner/Admin/Member/Viewer) can view history |
| Default categories | Seed each new workspace with the constitution's fixed Saudi-relevant list (Restaurants, Groceries, Fuel, Transportation, Rent, Utilities, Internet & Mobile, Health, Education, Family, Shopping, Entertainment, Travel, Subscriptions, Other) |
| Report export | View-only in MVP; no CSV/PDF export |
| Tech stack | Next.js 14 + React + Tailwind + Shadcn (frontend); Python + FastAPI (backend); Supabase Auth/Postgres/Vault/Storage; monolith repo; Bunny Magic Containers deployment |

## Repository Structure

```
apps/web/         Next.js frontend
apps/api/         FastAPI backend
packages/shared/  Shared types/constants/validation contracts
supabase/         Migrations, RLS policies, seed data, storage policies
specs/            Per-feature Spec-Kit specs (created by /speckit-specify)
docs/             Practical docs incl. this file
infra/            Deployment config/env notes for Bunny Magic Containers
tests/            Cross-app testing strategy docs
```

Directories are scaffolded as empty boundaries now; real content lands as
each phase is implemented, so structure never drifts ahead of actual code.

## Phase Order (each phase = one Spec-Kit feature cycle)

1. **Foundation & repo setup** — monolith boundaries, env docs, local dev setup.
2. **Auth + workspace foundation** — Supabase email/password auth, personal workspace auto-created on signup, team workspace creation, membership, roles (Owner/Admin/Member/Viewer fixed permissions), email-invite-link flow, RLS tenant isolation.
3. **Income, expense, category core** — confirmed-state model, CRUD, seeded default categories, fixed-precision money handling (no floats).
4. **Backend financial calculations & dashboard data** — authoritative remaining-balance/totals in FastAPI, category breakdown, recent activity — single source reused by both dashboard and reports.
5. **Frontend core experience** — auth screens, workspace selector, dashboard, income/expense forms, category UI, Arabic/English + RTL readiness, SAR-first formatting.
6. **Receipt/invoice storage** — private Supabase Storage upload (images/PDFs), workspace-scoped file metadata, link to expenses, auto-delete setting (default off).
7. **BYOK AI settings** — Gemini/OpenAI provider selection, key storage via Supabase Vault, never exposed to frontend, app fully usable without it.
8. **AI extraction & review** — extraction job lifecycle (pending/processing/completed/failed/confirmed/cancelled), draft results excluded from totals until confirmed, review/edit UI, confirm → expense conversion, auto-delete respected.
9. **Reports, summaries, history** — view-only reports from confirmed records only, team activity summary, pending-review summary, history visible to all members, optional AI spending summaries (confirmed-data only, no financial advice).
10. **Testing, security review, deployment** — financial-accuracy and tenant-isolation test suites per Constitution X/XIV, file-privacy tests, AI key exposure tests, Bunny Magic Containers deployment docs/checklist.

Each phase's Spec-Kit cycle must pass the constitution's Constitution Check
gate (financial accuracy, tenant isolation, manual-first/AI-optional,
Saudi-first defaults) before moving to the next phase.

## Out of Scope

Bank connections, payment gateway, subscription billing, investment
tracking, debt management, payroll, tax filing, full accounting ledger,
enterprise permission system, complex multi-currency, report export,
OAuth login, per-workspace permission toggles — all explicitly deferred.

## Next Step

Run `/speckit-specify` for Phase 1 (Foundation & repo setup) to produce the
first real `specs/001-foundation/spec.md`.
