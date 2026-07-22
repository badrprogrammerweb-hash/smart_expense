# Contract: Design Tokens

**Type**: UI contract (not an HTTP API). Defines the token surface every
refreshed screen and primitive must consume. Source of truth:
`apps/web/app/globals.css` (`:root` custom properties + `@theme inline`).

## Rules

- **T-1**: All color, typography, spacing, radius, shadow, and motion values in
  refreshed components MUST reference a named token — no page-specific color
  literals or ad-hoc pixel values outside the defined scale.
- **T-2**: Colors are defined in **OKLCH** (extending the existing set). The
  brief's hex anchors are translated to OKLCH; the accent stays emerald
  (`--color-primary` ≈ `#0F7A5C`).
- **T-3**: The meaning-carrying families `income`/`expense`/`pending`/`info`
  MUST each expose `-foreground`, `-subtle`, and `-border` variants and MUST
  always be paired with an icon or text label in use (never color-only).
- **T-4**: `--color-primary-hover` and `--color-surface-hover` MUST exist and be
  used for hover/press; hover MUST darken (never lighten); press MUST scale
  interactive elements to 0.98.
- **T-5**: `--shadow-focus` MUST render a visible ~3px accent focus ring on
  every interactive element; focus styles MUST NOT be suppressed.
- **T-6**: Radius tokens MUST be applied consistently — control 8px, card 12px,
  badge/status pill full-round; no mixed radii on the same surface.
- **T-7**: Spacing MUST come from the 4/8/12/16/24/32/48 scale.
- **T-8**: Typography MUST use the Tajawal family variable for body across both
  locales; financial values MUST use the 20–32px semibold tabular-numeral
  scale so amounts outrank surrounding labels.
- **T-9**: **Light theme only.** No dark-theme token values are authored; the
  existing unused `dark` variant MUST NOT be expanded.

## Verification

- Token existence + values asserted by a Vitest/DOM smoke check and by the
  primitive unit specs.
- T-3/T-4/T-5 verified via the accessibility (`@axe-core`) and visual-regression
  checks on representative screens (contrast, focus visibility).
