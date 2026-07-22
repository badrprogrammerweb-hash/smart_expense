# Contract: F-001 Date Display

**Type**: UI contract. Resolves known issue **F-001** (reversed date separators
in RTL). All date rendering across the application MUST conform.

## Rules

- **D-1**: A **single** date helper (`lib/format/date.ts`) is the only place
  dates are formatted for display. No component formats dates inline.
- **D-2**: Display format is exactly `DD/MM/YYYY` (zero-padded day/month,
  4-digit year), **everywhere**, in both locales. No localized alternative
  display format is introduced this phase.
- **D-3**: Digits are **Western** (`0123456789`) in both `ar` and `en`; Eastern
  Arabic-Indic digits are never used.
- **D-4**: The rendered date is wrapped with `dir="ltr"` (isolated) so
  bidirectional heuristics cannot reorder it; separators and component order are
  preserved inside RTL layouts. Tabular numerals via `--numeric-feature`.
- **D-5**: Dates align consistently across **tables, filters, forms, and cards**
  (FR-008).
- **D-6**: The same rule applies to other technical/Latin values shown near
  dates (emails, file names, provider identifiers, URLs, error codes): isolated
  `dir="ltr"` (FR-007).

## Verification (FR-009)

- **Unit**: Vitest asserts the helper output string is `DD/MM/YYYY` with Western
  digits for representative inputs and that the wrapper carries `dir="ltr"`.
- **E2E desktop (chromium)**: assert a date in a **table**, a **filter**, a
  **form** field, and a **card** renders `DD/MM/YYYY` with no reversed
  separators in the `ar` (RTL) locale.
- **E2E mobile-RTL project**: the same assertions on a mobile device profile in
  `ar`, satisfying "verified on at least one mobile Arabic RTL environment."
- **Visual regression**: screenshot baselines of an RTL table and an RTL form
  including dates.
