# Contract: UI Primitive Components

**Type**: UI contract. Defines the behavioral/accessibility guarantees each
`components/ui/` primitive must satisfy. Prop shapes follow shadcn/CVA
conventions; this contract fixes *behavior and states*, not exact prop names.

## Global rules (all primitives)

- **P-1**: Token-driven only (see `design-tokens.md`); no hard-coded visual
  literals.
- **P-2**: Direction-correct via **logical CSS properties** (`start`/`end`,
  `ms-*`/`me-*`, `text-start`), so one implementation renders correctly in both
  RTL (`ar`) and LTR (`en`). Directional icons flip via `rtl:` only where
  meaning is directional.
- **P-3**: Present every applicable interaction state — default, hover, focus,
  active, selected, disabled, loading, error, success (FR-016). Focus ring
  always visible; size MUST NOT change between default and loading.
- **P-4**: Keyboard operable; correct roles/labels; dialogs are focus-trapped
  and labelled (WCAG AA, FR-025).
- **P-5**: Touch targets ≥ 44×44px with adequate spacing (FR-025).
- **P-6**: Public props/behavior are stable enough that adopting feature
  components need no behavioral change (supports behavior-green suites).

## Per-primitive guarantees (selected)

- **Button / IconButton**: variants (primary, secondary/neutral, destructive,
  ghost); `loading` shows a label/spinner without resizing and blocks repeat
  submit; IconButton has an accessible name.
- **Amount input**: groups amount + sign + currency indicator, correctly
  ordered in RTL; opens a numeric keyboard on mobile; never offers a per-record
  currency selector.
- **Date field / date display**: renders via the F-001 helper only (see
  `date-format-f001.md`).
- **Select / combobox, hierarchical category picker**: distinguishes main vs.
  subcategory; shows translated system names and as-entered user names; keeps
  income and expense sets separate; disabled categories remain identifiable.
- **Table ↔ mobile-record-card**: the same record data renders as a table on
  desktop and as cards/compact rows on mobile without forcing horizontal scroll;
  shows type, amount, category (main+sub), merchant/source, date, status, actor
  (when relevant), actions.
- **Status badge**: encodes extraction/record status with icon+label+color
  (never color alone); pending extraction is visually distinct from confirmed.
- **Dialog / confirm-dialog**: modal, scrim, focus-trapped; confirm-dialog
  states the consequence plainly for destructive actions; currency-change
  warning dialog requires explicit confirmation and never implies conversion.
- **Empty / error / permission-denied / skeleton**: standardized; empty guides
  toward permitted first actions (no mandatory wizard); error is
  understandable and not color-only; permission-denied explains the role
  restriction; skeleton/progress replaces bare spinners and announces status to
  screen readers.
- **Summary card (dashboard)**: remaining balance rendered as the visually
  dominant element; cards are not all equal weight.
- **Chart**: accompanied by a textual summary or supporting data; distinguishes
  income vs. expense without relying on color alone; uses workspace currency.
- **Receipt preview**: shows the user's file true-to-source in a neutral frame;
  never exposes internal identifiers or storage tokens.

## Verification

- Vitest + RTL unit specs per primitive assert states, roles/labels, RTL/LTR
  rendering, and (where relevant) numeric-keyboard / no-resize-on-loading.
- `@axe-core/playwright` asserts WCAG AA on screens composed from primitives.
