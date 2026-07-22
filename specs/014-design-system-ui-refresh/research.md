# Phase 0 Research: Design System and UI Refresh

This document resolves the open technical decisions for Phase 14. Each decision
is grounded in the approved design brief
(`docs/design/claude-design-final/uploads/design-brief.md`), the reference kit
(`docs/design/claude-design-final/`, treated as a v0 illustrative reference),
the constitution, and the actual `apps/web` baseline inspected during planning.

---

## Decision 1 — Reference kit status: brief is authoritative, kit is v0

**Decision**: Treat the written design **brief** as the authoritative
requirements source. Treat the reference **kit** (tokens, JSX, HTML specimens)
as an illustrative v0 to adapt, never as final code to copy.

**Rationale**: The kit's own `readme.md` states it was authored from the brief
alone with no codebase access, is Arabic-only, light-only, uses Google-Fonts
substitutes and a wordmark placeholder, and says "if the real codebase becomes
available, re-derive tokens/components from it." The real codebase is now
available and already ships both locales (Phase 12) and hierarchical categories
(Phase 13). Copying the kit verbatim would regress English/LTR support and
import CDN fonts against our self-hosting posture.

**Alternatives considered**: (a) Port the kit's JSX directly — rejected: it is
Arabic-only and not wired to our next-intl/Tailwind-v4/OKLCH stack. (b) Ignore
the kit — rejected: its component inventory, interaction states, and F-001
pattern are the concrete expression of the brief and are reused as design
targets.

---

## Decision 2 — Token reconciliation: extend the existing OKLCH `@theme`

**Decision**: Keep the existing Tailwind-v4 CSS-first token system in
`app/globals.css` (OKLCH custom properties under `:root` + `@theme inline`) and
**extend** it. Add the brief's meaning-carrying semantic families that do not
yet exist — `income` (green), `expense` (red), `pending` (amber), `info`
(blue) — each with `-foreground`, `-subtle` (tinted surface), and `-border`
variants, plus `--color-primary-hover` and `--color-surface-hover`. Translate
the brief's hex anchors (accent emerald `#0F7A5C`, state colors) into OKLCH so
the whole system stays in one color space. Add radius (control 8px / card 12px
/ pill), shadow (`--shadow-card`, `--shadow-dialog`, `--shadow-focus`), and a
4/8/12/16/24/32/48 spacing scale as tokens.

**Rationale**: The existing `--primary` is already `oklch(0.42 0.12 174)` — a
teal essentially matching the brief's emerald — so the accent barely moves. The
gap is the missing *semantic* families and state variants, which today are
ad-hoc per component. Extending in the established OKLCH space avoids a
dual-format token set and keeps `cssVariables: true` shadcn theming intact.
Colorblind-safety (FR-013/FR-019/FR-027) is met by always pairing color with
icon/label, not by the hue alone.

**Alternatives considered**: (a) Replace OKLCH with the kit's hex tokens —
rejected: churns every existing token reference and loses OKLCH's perceptual
uniformity for no benefit. (b) Add a parallel token file — rejected: two
sources of truth; `globals.css` is already the single `@theme` entry.

---

## Decision 3 — Shared primitive layer: generate `components/ui/`

**Decision**: Create the shared shadcn primitive layer at
`apps/web/components/ui/` (the path `components.json` already aliases to `"ui"`),
built on the reconciled tokens with `class-variance-authority` variants, and
adopt it incrementally per screen. Map primitives to the brief's Section 20
inventory (button, input, amount input, date field, select, textarea, file
upload, tabs, table, mobile record card, pagination, filter bar, search field,
dialog, confirm dialog, dropdown menu, card, summary card, info card, status
badge, alert, toast, skeleton, empty/error/permission states, page heading,
receipt preview, chart).

**Rationale**: The folder was aliased but never generated, so today every
feature component is hand-styled — the direct cause of the inconsistency the
phase exists to fix. Generating it *completes* the intended shadcn setup rather
than introducing new structure. Incremental adoption (foundation → shell →
screen-by-screen) bounds the regression surface and lets each screen's tests
stay green as it lands.

**Alternatives considered**: (a) Big-bang rewrite of all screens at once —
rejected: unbounded regression surface, hard to keep suites green, poor review
granularity. (b) Restyle feature components in place without a shared layer —
rejected: reproduces the root cause (no shared source of truth).

---

## Decision 4 — Typography: self-host Tajawal via `next/font`

**Decision**: Introduce Tajawal (the brief's primary Arabic-first family) via
`next/font/google` (self-hosted/optimized at build time), replacing the current
`font-family: Arial` body font. Load only the weights actually used (e.g.,
400/500/700), set `font-display: swap`, and expose it as a CSS variable
consumed by the token layer. Tajawal covers Latin glyphs too, so it serves both
`ar` and `en`; financial values use tabular numerals.

**Rationale**: The brief calls for Tajawal or IBM Plex Sans Arabic; the kit only
substituted Google-CDN links because it had no font files. `next/font`
self-hosts, eliminating the runtime CDN dependency and the layout-shift/privacy
concerns, and ties directly to the SC-012 no-regression guardrail (subset +
swap keep the load cost bounded).

**Alternatives considered**: (a) Runtime Google Fonts `<link>` (as in the kit)
— rejected: external runtime dependency, CLS risk, weaker perf control. (b)
Keep Arial — rejected: fails the approved Arabic-first typography direction.

---

## Decision 5 — F-001 resolution: one centralized isolated-LTR date helper

**Decision**: Centralize all date rendering in a single helper
(`lib/format/date.ts`) that formats to one `DD/MM/YYYY` string with Western
digits and renders it wrapped `dir="ltr"` (with `font-feature-settings` for
tabular numerals), exposed through a small primitive so tables, filters, forms,
and cards all consume the same isolated component. No component formats dates
inline or relies on bidi heuristics.

**Rationale**: F-001 (reversed separators in RTL) is caused by leaving dates to
browser bidirectional-text heuristics inside RTL. The brief's recommended
pattern is `<span dir="ltr">13/07/2026</span>` with a single consistent format.
A single helper/primitive guarantees uniform format and isolation everywhere and
gives one place to assert against in tests (contract:
`contracts/date-format-f001.md`).

**Alternatives considered**: (a) Per-component `Intl.DateTimeFormat` — rejected:
format drift and re-introduces the isolation bug per call site. (b) CSS
`unicode-bidi: isolate` only — rejected: helps direction but not format
consistency; the explicit `dir="ltr"` wrapper is the brief's prescribed,
testable pattern.

---

## Decision 6 — Direction-aware shell reuses existing locale/direction plumbing

**Decision**: Build the refreshed RTL/LTR shell on the existing direction
infrastructure — `app/[locale]` routing, `LocaleDirectionSync` (keeps
`<html dir>` in sync on client navigation), and `directionForLocale` in
`i18n/routing`. The sidebar sits at the inline-start edge (right in RTL, left
in LTR) using logical CSS properties (`start`/`end`, `ms-*`/`me-*`) so a single
implementation mirrors automatically. Directional icons flip only where meaning
is directional (e.g., navigation chevrons), via `rtl:` variants.

**Rationale**: Phase 12 already solved locale/direction switching; the refresh
should restyle on top of it, not re-solve it. Tailwind v4 logical properties +
the existing `dir` attribute give correct mirroring without duplicated LTR/RTL
trees, satisfying FR-004/FR-005 and keeping component dimensions stable across
languages.

**Alternatives considered**: (a) Separate RTL and LTR layout components —
rejected: double maintenance, drift risk. (b) Physical `left/right` utilities +
manual flips — rejected: error-prone; logical properties are the idiomatic
Tailwind-v4 approach.

---

## Decision 7 — Interaction states via CVA variants; light-mode only

**Decision**: Encode the nine required interaction states (default, hover,
focus, active, selected, disabled, loading, error, success) as
`class-variance-authority` variants/states on each primitive, with a visible
3px accent focus ring on all interactive elements and no size change during
loading. Build **no dark-mode styles**: the existing `@custom-variant dark` in
`globals.css` is left unused and not expanded.

**Rationale**: FR-016 requires every interactive component to present all
states consistently; CVA (already a dependency) centralizes them per primitive.
Dark mode is explicitly out of scope (FR-028); leaving the existing variant
untouched avoids scope creep while not fighting the current file.

**Alternatives considered**: (a) Ad-hoc per-component state classes — rejected:
reproduces inconsistency. (b) Remove the `dark` variant — rejected: unnecessary
churn; simply do not author dark styles.

---

## Decision 8 — Responsive: mobile as a deliberate layout, tables → cards

**Decision**: Treat mobile as a first-class layout. Desktop record lists use the
`table` primitive; at mobile breakpoints they render as the `mobile-record-card`
/ compact-row primitive instead of horizontally scrolling. Navigation collapses
to a direction-aware drawer. Enforce ≥44×44px touch targets and safe-area
spacing. Use the brief's breakpoint bands (phone, tablet, laptop, large
desktop). No PWA/offline behavior is added (FR-028) — only PWA-*ready*
responsive structure.

**Rationale**: FR-024/FR-012 and SC-005 require deliberate mobile layouts with
reachable primary actions; the brief (§22) mandates table→card conversion. This
also prepares (without implementing) Phases 15/16.

**Alternatives considered**: (a) Responsive-shrunk desktop tables — rejected by
the brief (mobile must not be a scaled-down desktop). (b) Introduce a
PWA/offline layer now — rejected: out of scope.

---

## Decision 9 — Testing infrastructure: extend Playwright, add axe

**Decision**: (1) Add a **mobile-RTL Playwright project** (a mobile device
profile exercising the `ar` locale) to the current chromium-desktop-only config,
for F-001 and responsive verification. (2) Add **screenshot visual-regression**
via Playwright `toHaveScreenshot` with committed baselines for a representative
set of key screens/states per locale. (3) Add **`@axe-core/playwright`** for
WCAG AA assertions (contrast, roles, labels, focus) on those same screens. (4)
Keep Vitest + RTL for per-primitive/component unit specs. Represent the full
screen inventory with a documented **manual review sweep** (checklist), not
exhaustive automation.

**Rationale**: Matches the clarified testing decisions (reuse Playwright for
visual regression; representative automated coverage + manual sweep). axe is the
standard programmatic WCAG checker and integrates with Playwright. A mobile-RTL
project is required because F-001 must be verified "on at least one mobile
Arabic RTL environment" (FR-009).

**Alternatives considered**: (a) A separate visual tool (Percy/Chromatic) —
rejected by clarification (reuse existing setup, no new tool). (b) Manual-only
a11y — rejected: not repeatable; axe gives a regression gate.

---

## Decision 10 — Test-suite policy: behavior-green, not byte-identical

**Decision**: Define "suites stay green" as **behavior-green**. Behavioral,
user-flow, financial-accuracy, role-permission, and RTL/LTR-direction assertions
in existing specs MUST continue to pass. Presentation-coupled assertions (DOM
selectors, class names, screenshot baselines) MAY be updated to match the
refreshed markup — expected churn, not regression. The **entire backend
`pytest` suite is re-run unmodified** and must pass as-is.

**Rationale**: A repaint necessarily changes DOM/classes/screenshots, so
existing specs that assert on current markup (e.g.,
`acc-localization-rtl.spec.ts`, feature `__tests__`) will need selector/baseline
updates. Without this explicit line, the implementer either freezes the markup
(blocking the refresh) or over-rewrites behavior. The real regression gate is
behavior + backend, encoded in FR-029 and SC-010/SC-011.

**Alternatives considered**: (a) Byte-identical "green" — rejected: impossible
for a visual refresh. (b) Rewrite all tests freely — rejected: would let
behavioral coverage silently erode.

---

## Decision 11 — Currency & hierarchical-category presentation reuse Phase 12/13

**Decision**: Reuse the existing currency formatting (Phase 12) and category
hierarchy data/selection (Phase 13) unchanged; the refresh only restyles their
presentation — workspace-currency formatting everywhere, amount/sign/currency
grouped and non-color-only, per-record currency selector absent, main/subcategory
distinction clear, translated system names vs. as-entered user names, disabled
categories still visible in history. The "future-state"-labelled kit pieces
(language switcher, currency selector, currency-change warning, hierarchical
picker) are current-state and restyled in both locales.

**Rationale**: FR-013/FR-014/FR-015 restate already-shipped behavior; this phase
must not alter it, only apply the standardized components. Existing components
(`WorkspaceCurrencySelector`, `LanguageSwitcher`, `CategoryPicker`) are adopted
onto the primitive layer with props/behavior preserved.

**Alternatives considered**: (a) Re-derive currency/category logic — rejected:
out of scope and risks financial/behavioral regression.

---

## Open questions

None. All Technical Context unknowns are resolved above. No `NEEDS
CLARIFICATION` markers remain.
