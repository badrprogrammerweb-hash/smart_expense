# Phase 1 Data Model: Design System Inventory

**Note**: This is a frontend visual/interaction refresh. It introduces **no new
persisted database entity** and changes **no existing schema, column, or
relationship**. The domain entities (income, expense, category, file,
extraction, workspace, member, settings, history) are consumed exactly as they
exist after Phases 12–13.

Accordingly, the "data model" for this phase is the **design-system inventory**:
the tokens, primitive components, screen inventory, and interaction states that
the refresh must deliver. These are the structured artifacts tasks and tests are
generated from.

---

## 1. Design Token Set

Named visual values exposed as CSS custom properties in `app/globals.css`
(OKLCH color space; Tailwind-v4 `@theme inline`). All refreshed screens
reference tokens — never page-specific literals.

### 1.1 Color — accent & neutrals (extend existing)

| Token | Meaning | Notes |
|-------|---------|-------|
| `--color-primary` / `-foreground` | Emerald accent for primary actions, links, active nav | Exists (~`oklch(0.42 0.12 174)` ≈ `#0F7A5C`) |
| `--color-primary-hover` | One-step-darker accent on hover/press | **New** |
| `--color-background`, `--color-foreground` | App background / body text | Exists |
| `--color-card`, `--color-card-foreground` | Card surface / text | Exists |
| `--color-muted`, `--color-muted-foreground` | Secondary metadata text/surfaces | Exists |
| `--color-surface-hover` | Neutral surface hover tint | **New** |
| `--color-border`, `--color-input`, `--color-ring` | 1px borders / input border / focus ring | Exists |

### 1.2 Color — meaning-carrying families (new, always paired with icon/label)

| Family | Tokens | Meaning |
|--------|--------|---------|
| Income / success | `--color-income`, `-foreground`, `-subtle`, `-border` | Money in, success |
| Expense / destructive | `--color-expense`, `-foreground`, `-subtle`, `-border` | Money out, destructive |
| Pending / warning | `--color-pending`, `-foreground`, `-subtle`, `-border` | Ready-for-review, warning |
| Informational | `--color-info`, `-foreground`, `-subtle`, `-border` | Neutral info |

**Rule**: color never carries meaning alone (FR-013/FR-019/FR-027) — every
colored state also has an icon or label.

### 1.3 Typography

| Token | Value | Notes |
|-------|-------|-------|
| `--font-arabic` (body) | Tajawal (self-hosted via `next/font`) | Replaces `Arial`; serves ar + en |
| Financial value scale | 20–32px, semibold, tabular numerals | Amounts outrank labels |
| Body / table | 14–15px | |
| Metadata | 13px | |
| `--numeric-feature` | tabular-nums font-feature-settings | For amounts + dates |

### 1.4 Spacing, radius, elevation, motion

| Token group | Values |
|-------------|--------|
| Spacing scale | 4 / 8 / 12 / 16 / 24 / 32 / 48 px |
| Radius | control 8px, card 12px, badge pill (full) |
| Shadow | `--shadow-card` (barely-there), `--shadow-dialog`, `--shadow-focus` (3px accent ring) |
| Motion | 120–160ms ease on hover/focus/press; press scale 0.98; no decorative motion |
| Elevation order | page → card (border) → dropdown (border+soft shadow) → dialog (shadow+scrim) → toast |

Theme: **light only** (no dark tokens authored).

---

## 2. Standardized Primitive Components (`components/ui/`)

Each primitive is token-driven, RTL/LTR-correct (logical properties), and
presents all applicable interaction states. Grouped per the brief's Section 20.

| Group | Primitives |
|-------|-----------|
| Core | `button`, `icon-button`, `badge`, `alert`, `toast` |
| Forms | `input`, `amount-input`, `date-field`, `select`, `textarea`, `file-upload`, form field/label/error wrappers |
| Overlays | `dialog`, `confirm-dialog`, `dropdown-menu` |
| Navigation shell | app shell, `sidebar`, mobile nav drawer, workspace switcher, top header, `page-heading`, `tabs`, language switcher |
| Data | `table`, `mobile-record-card`, `pagination`, `filter-bar`, `search-field` |
| Feedback | `empty-state`, `error-state`, `permission-denied-state`, `skeleton` |
| Finance | `summary-card`, `info-card`, `status-badge`, `receipt-preview`, AI review form, `chart` |
| Locale/currency/category | language switcher, workspace base-currency selector, currency-change warning dialog, hierarchical category picker, main/subcategory presentation |

Contract detail: `contracts/ui-primitives.md`.

---

## 3. Screen Inventory (must all adopt the system)

Every existing route/screen; none omitted (FR-002).

| # | Screen | Route |
|---|--------|-------|
| 1 | Locale landing / redirect | `app/[locale]/page.tsx` |
| 2 | Sign in | `(auth)/sign-in` |
| 3 | Sign up | `(auth)/sign-up` |
| 4 | Reset password | `(auth)/reset-password` |
| 5 | Workspace shell/layout | `w/[workspaceId]/layout.tsx` |
| 6 | Dashboard | `w/[workspaceId]/dashboard` |
| 7 | Incomes | `w/[workspaceId]/incomes` |
| 8 | Expenses | `w/[workspaceId]/expenses` |
| 9 | Categories | `w/[workspaceId]/categories` |
| 10 | Files / receipts | `w/[workspaceId]/files` |
| 11 | Extraction queue | `w/[workspaceId]/extractions` |
| 12 | Extraction review | `w/[workspaceId]/extractions/[extractionId]` |
| 13 | Reports | `w/[workspaceId]/reports` |
| 14 | History | `w/[workspaceId]/history` |
| 15 | Settings (incl. AI, currency, language, auto-delete) | `w/[workspaceId]/settings` |
| 16 | New workspace / members | `w/[workspaceId]/new-workspace` |

Each screen must present, where applicable: empty, loading, error, and
permission-denied states (FR-017–FR-020).

---

## 4. Interaction State Set

Per interactive primitive (FR-016): `default`, `hover`, `focus`, `active`,
`selected`, `disabled`, `loading`, `error`, `success`. Focus is always visibly
ringed; controls never resize during `loading`.

---

## 5. Locale / Direction Matrix

| Axis | Values |
|------|--------|
| Locale | `ar` (RTL, default), `en` (LTR) |
| Direction handling | logical CSS properties + `<html dir>` via existing `LocaleDirectionSync` |
| Text policy | system text translated; user content never auto-translated; technical/Latin values isolated `dir="ltr"` |
| Numerals | Western digits both locales |
| Dates | single `DD/MM/YYYY`, isolated LTR (see `contracts/date-format-f001.md`) |
| Currency | workspace base currency (Phase 12), unchanged logic |

---

## 6. Explicit non-entities

No table, column, migration, RLS policy, storage policy, API field, or
enum value is added or changed by this phase. If any refreshed screen appears
to require new data, that is a signal to re-scope — not to add backend behavior
here (plan Constraints; FR-026).
