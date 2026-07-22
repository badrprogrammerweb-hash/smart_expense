# Implementation Plan: Design System and UI Refresh Implementation

**Branch**: `014-design-system-ui-refresh` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-design-system-ui-refresh/spec.md`

## Summary

Phase 14 applies the Phase 11 approved design system across the entire
existing `apps/web` surface — every route, both locales (Arabic RTL / English
LTR), and every viewport (phone → large desktop) — as a **frontend
visual/interaction-layer refresh only**. No backend endpoint, database schema,
financial-calculation, permission, or business-logic change is made.

The central technical move: the app currently has **no shared UI primitive
layer** — `components.json` already aliases `"ui": "@/components/ui"`, but that
folder was never generated, so every feature component is hand-styled. That is
the root cause of the visual inconsistency. The plan **introduces a
token-driven `components/ui/` primitive layer** (built from the approved design
tokens) and then **adopts it incrementally, screen by screen**, preserving each
feature component's public props and behavior. This bounds the regression
surface, keeps the suites behavior-green per screen, and matches the P1→P2
story slicing in the spec.

Alongside the primitives: reconcile the existing OKLCH `@theme` tokens with the
brief's palette (adding income/expense/pending/info semantic families and their
subtle/border/hover variants), introduce the Arabic-first typeface (Tajawal)
replacing the current `Arial` body font, resolve F-001 with a single isolated
`DD/MM/YYYY` date primitive, and stand up the test infrastructure the spec
requires (mobile-RTL Playwright project, screenshot baselines, `@axe-core`
accessibility checks).

## Technical Context

**Language/Version**: TypeScript 5.7 on Next.js 16.2.x (App Router) / React
18.3 for `apps/web`. This phase touches **only** `apps/web` (frontend). No
change to `apps/api` (Python/FastAPI) source and no change to `supabase/`
migrations or policies. The backend test suite is re-run unmodified as a
regression gate.

**Primary Dependencies**: No new runtime framework. Reuses already-present
Tailwind CSS v4 (CSS-first `@theme` in `app/globals.css`, no `tailwind.config`
file), `shadcn/ui` conventions (`components.json`, style `base-nova`, `rtl:
true`, lucide icons), `class-variance-authority` + `clsx` + `tailwind-merge`
(`cn()` in `lib/utils.ts`), `next-intl` v4 (locale routing + `messages/{ar,en}.json`),
`@tanstack/react-query`, `react-hook-form` + `zod`. **New dev-only additions**:
`@axe-core/playwright` (accessibility assertions) and Tajawal via `next/font`
(self-hosted at build time — no runtime CDN, avoids the design-kit's flagged
Google-Fonts substitution). No new production dependency that changes bundle
behavior beyond the font.

**Storage**: N/A this phase. No schema, migration, RLS, or storage-policy
change. Existing persisted user language preference and workspace base currency
(Phase 12) and category hierarchy (Phase 13) are consumed as-is.

**Testing**: Vitest + React Testing Library for primitive and feature
components (extend existing `components/**/__tests__/*`); Playwright for
end-to-end flows and — new this phase — screenshot-based **visual regression**
(`toHaveScreenshot`) and **accessibility** (`@axe-core/playwright`) on a
representative set of key screens/states per locale. Playwright is currently
**chromium-desktop only**; this phase adds a **mobile-RTL project** (a mobile
device profile driving the `ar` locale) for F-001 and responsive verification.
Existing e2e specs (`e2e/*.spec.ts`) are re-run; their behavioral/flow/
direction assertions must stay green, while presentation-coupled assertions
(selectors, class names, screenshots) may be updated to the new markup. The
full backend `pytest` suite is re-run unmodified.

**Target Platform**: Browser — desktop, tablet, and mobile web — in both `ar`
(RTL) and `en` (LTR) locales. Unchanged deployment posture (Bunny Magic
Containers, Phase 10). Light mode only (no dark theme).

**Project Type**: Web application (existing `apps/api` + `apps/web` monolith).
This phase is scoped to `apps/web` only.

**Performance Goals**: No absolute latency/throughput SLA. Soft guardrail
(SC-012, FR-030): no significant regression in initial load or interaction
responsiveness versus the pre-refresh baseline. The one real cost driver is the
web font — mitigated with `next/font` self-hosting, `font-display: swap`, and a
subset limited to the weights actually used.

**Constraints**: Frozen contracts — no change to API request/response shapes,
DB schema, financial rules, confirmed-only totals, role permissions, auth, AI
provider behavior, file-storage rules, history append-only behavior, or
workspace isolation (FR-026, Constitution Principles VI/VII/IX/X). Single
`DD/MM/YYYY` isolated-LTR date format everywhere (FR-008). Western digits only.
Light theme only. Out-of-scope features (dark mode, exports, global search,
notification center, PWA/offline/native, product-support purchases) MUST NOT be
introduced (FR-028).

**Scale/Scope**: 16 route pages + 2 auth-group layouts, ~45 feature components
across 9 feature folders, 3 layout components, plus the new `components/ui/`
primitive layer (~30 primitives mapping to the brief's Section 20 inventory).
Two locales × four viewport bands. No new persisted entities.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I / III / XV (scope & scope control)**: A visual/UX refresh of
  the already-in-scope MVP surface adds no adjacent-domain feature; it only
  restyles existing income/expense/category/receipt/report/settings screens.
  No banking, accounting, payments, or enterprise workflow is introduced.
  **Pass.**
- **Principle II (budgeting philosophy)**: Remaining balance stays
  `confirmed income − confirmed expenses`; the refresh only changes how it is
  *displayed* (made visually dominant, FR-010), never how it is computed.
  **Pass.**
- **Principle IV (Saudi-first defaults)**: Arabic-first RTL remains the default;
  SAR-first formatting, Western digits, and the mandated category names are
  preserved. The refresh strengthens Arabic typography (Tajawal) and RTL
  correctness. **Pass.**
- **Principle V (manual-first, AI-optional)**: AI review stays visually
  non-final and distinct from confirmed records (FR-022); nothing in the
  refresh lets AI auto-create or auto-confirm records. **Pass.**
- **Principle VI (privacy & security)**: API keys stay masked; no full keys,
  tokens, vault values, or internal DB identifiers are surfaced (FR-023).
  Presentation-only change; backend validation unaffected. **Pass.**
- **Principle VII (workspace isolation)**: No change to how workspace scope is
  enforced; permission-denied states only *explain* existing role restrictions
  (FR-020), they do not gate on the frontend as source of truth. **Pass.**
- **Principle IX (architecture authority)**: The frontend remains display-only;
  no calculation or authorization logic moves into `apps/web`. Frozen API
  contracts (FR-026). **Pass.**
- **Principle X (financial accuracy — NON-NEGOTIABLE)**: No change to amount
  storage, summation, or record status. Amount/sign/currency formatting stays
  correct and non-color-only in RTL (FR-013); totals are unchanged and verified
  by the unmodified backend suite (SC-011). **Pass.**
- **Principle XI (reports integrity)**: Reports/charts restyled only; still
  computed from confirmed records; pending AI never shown as confirmed
  (FR-027, FR-022). **Pass.**
- **Principle XIV (testing requirements)**: Adds visual-regression, WCAG AA,
  and e2e coverage; keeps behavioral/financial/permission/isolation/RTL
  assertions green; backend suite re-run unmodified (FR-029, SC-010/SC-011).
  **Pass.**
- **Principle XVI (spec-kit workflow)**: This plan follows the clarified
  `spec.md`; implementation (Codex) does not begin until `/speckit-tasks` and
  `/speckit-analyze` complete, per session instruction. **Pass.**

No violations identified; **Complexity Tracking is not needed**.

## Project Structure

### Documentation (this feature)

```text
specs/014-design-system-ui-refresh/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output — token & component inventory (no DB entities)
├── quickstart.md        # Phase 1 output — validation/run guide
├── contracts/           # Phase 1 output — UI contracts (not HTTP APIs)
│   ├── design-tokens.md         # token names/semantics the UI must expose
│   ├── ui-primitives.md         # primitive component prop/state contracts
│   ├── date-format-f001.md      # F-001 isolated-LTR DD/MM/YYYY contract
│   └── testing-contract.md      # visual-regression + a11y + coverage contract
├── checklists/
│   └── requirements.md          # spec quality checklist (/speckit-specify output)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

**Structure Decision**: Existing web-application monolith. This phase changes
**only `apps/web`**; `apps/api/` and `supabase/` are untouched (backend suite
re-run unmodified as a regression gate). The work introduces one new
directory — the shared primitive layer `apps/web/components/ui/` that
`components.json` already points at — and refactors existing feature components
and route pages to consume it, plus token/font/i18n and test-infra changes.

```text
apps/web/
├── app/
│   ├── globals.css                     # extended: reconciled token set (income/expense/
│   │                                   #   pending/info families + subtle/border/hover vars),
│   │                                   #   Tajawal font vars, radius/shadow/spacing scale;
│   │                                   #   light-only (no dark styles added)
│   ├── layout.tsx                      # extended: next/font (Tajawal) wiring
│   └── [locale]/
│       ├── layout.tsx                  # extended: refreshed app shell wrapper
│       ├── page.tsx                    # restyled (locale landing / workspace redirect)
│       ├── (auth)/{sign-in,sign-up,reset-password}/page.tsx  # restyled auth screens
│       └── w/[workspaceId]/
│           ├── layout.tsx              # restyled: sidebar/header shell, direction-aware nav
│           ├── {dashboard,incomes,expenses,categories,files,history,
│           │    reports,settings,new-workspace}/page.tsx      # adopt primitives/states
│           └── extractions/{page.tsx,[extractionId]/page.tsx} # AI review restyle (non-final)
│
├── components/
│   ├── ui/                             # NEW — token-driven shadcn primitive layer
│   │   ├── button.tsx  icon-button.tsx  badge.tsx  alert.tsx  toast.tsx
│   │   ├── input.tsx  amount-input.tsx  date-field.tsx  select.tsx  textarea.tsx
│   │   ├── file-upload.tsx  tabs.tsx  table.tsx  mobile-record-card.tsx
│   │   ├── pagination.tsx  filter-bar.tsx  search-field.tsx
│   │   ├── dialog.tsx  confirm-dialog.tsx  dropdown-menu.tsx
│   │   ├── card.tsx  summary-card.tsx  info-card.tsx  status-badge.tsx
│   │   ├── skeleton.tsx  empty-state.tsx  error-state.tsx  permission-denied-state.tsx
│   │   ├── page-heading.tsx  receipt-preview.tsx  chart.tsx
│   │   └── __tests__/                  # Vitest specs per primitive (states, RTL, a11y)
│   ├── layout/                         # WorkspaceShell/Selector restyled onto ui/ + nav
│   ├── {category,dashboard,expense,extraction,files,history,income,
│   │    reports,settings}/*.tsx        # adopt primitives; public props/behavior preserved
│   └── providers.tsx                   # unchanged (or toast provider wiring only)
│
├── lib/
│   ├── utils.ts                        # unchanged (cn helper)
│   ├── format/date.ts                  # NEW/centralized: single DD/MM/YYYY isolated-LTR helper (F-001)
│   └── money.ts                        # EXISTING Phase 12 currency formatter — reused unchanged (no logic change)
│
├── messages/{ar,en}.json               # extended: new UI-state/nav strings only (no term changes)
│
├── playwright.config.ts                # extended: mobile-RTL project + screenshot config
├── e2e/
│   ├── *.spec.ts                       # existing flows re-run; presentation asserts updated as needed
│   ├── visual-regression.spec.ts       # NEW: toHaveScreenshot baselines (key screens × locale)
│   └── accessibility.spec.ts           # NEW: @axe-core/playwright WCAG AA checks
└── package.json                        # extended: @axe-core/playwright (dev), Tajawal font pkg if used
```

## Adoption Strategy (incremental, per-screen)

1. **Foundation first** (no visible screen change yet): reconcile tokens in
   `globals.css`, wire the Tajawal font, add the F-001 date helper, and scaffold
   the `components/ui/` primitives with their states + Vitest specs.
2. **Shell + navigation**: refresh the `w/[workspaceId]` layout (direction-aware
   sidebar, top header, mobile drawer, workspace switcher) — the frame every
   screen inherits.
3. **Per-screen adoption** in spec-priority order (dashboard → income/expenses
   lists & forms → categories → files → AI settings/extraction review → reports
   → history → settings/members → auth). Each screen: swap to primitives,
   standardize its empty/loading/error/permission states, verify both locales +
   mobile, then add/update its visual + a11y checks.
4. **Test infra + baselines**: land the mobile-RTL Playwright project and
   screenshot/a11y specs alongside the screens they cover; capture baselines
   once a screen is final.

Each feature component keeps its **public props and behavior** so the
behavioral/flow assertions in existing specs stay green while its markup and
classes change.

## Complexity Tracking

*No violations — table intentionally omitted.*
