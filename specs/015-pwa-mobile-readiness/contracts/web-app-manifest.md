# Contract: Web App Manifest and Install Affordance

**Feature**: `015-pwa-mobile-readiness` | **Covers**: FR-001 – FR-006a, SC-001

## 1. Manifest source and route

Declared as `apps/web/app/manifest.ts` exporting a `MetadataRoute.Manifest`.
Next.js serves it at `/manifest.webmanifest` and injects the
`<link rel="manifest">` tag. No `public/manifest.json` file is used.

## 2. Required fields

| Field | Value | Requirement |
|---|---|---|
| `id` | `/` | MUST be stable across deployments so the installed app is not duplicated |
| `name` | `Smart Expense - AI` | MUST match the product identity |
| `short_name` | `Smart Expense` | MUST fit a home-screen label (≤ 12 chars preferred) |
| `description` | A one-sentence description understandable to both Arabic and English audiences (FR-006) | MUST be present |
| `start_url` | `/` | MUST be locale-neutral; the existing `next-intl` middleware redirects to the user's locale, honouring `NEXT_LOCALE` (FR-004) |
| `scope` | `/` | MUST cover all application routes |
| `display` | `standalone` | MUST produce a window without browser navigation chrome (FR-003) |
| `orientation` | `portrait-primary` or omitted | MUST NOT lock out landscape use where the layout supports it (FR-032, FR-036) |
| `background_color` | `#fdfcf7` (resolved from Phase 14 `--background: oklch(0.99 0.006 95)`) | MUST match the design system (drives the launch screen) |
| `theme_color` | `#006148` (resolved from Phase 14 `--primary: oklch(0.42 0.12 174)`) | MUST match the design system and the `<meta name="theme-color">` value |
| `dir` / `lang` | `ltr` / `en` | A manifest declares one identity; per-locale manifests are not supported by platforms and are not attempted |
| `icons` | Section 3 | MUST be complete |

Fields that MUST NOT appear: `related_applications` /
`prefer_related_applications` (Phase 16), `share_target`, `shortcuts` beyond
existing routes, `protocol_handlers`, `display_override: ["window-controls-overlay"]`.

The manifest and viewport metadata must use the concrete sRGB values above;
they are the resolved values of the existing Phase 14 CSS tokens, not new
design tokens.

## 3. Icon inventory

Served from `apps/web/public/icons/`. No placeholder or upscaled asset ships.

| File | Size | `purpose` | Notes |
|---|---|---|---|
| `icon-192.png` | 192×192 | `any` | Baseline Android/desktop icon |
| `icon-512.png` | 512×512 | `any` | High-resolution and launch-screen source |
| `icon-512-maskable.png` | 512×512 | `maskable` | Content within the central 80% safe zone so Android's mask does not crop the wordmark (FR-002) |
| `apple-touch-icon.png` | 180×180 | — | Linked via `<link rel="apple-touch-icon">`; no transparency |

Deferred to Phase 16 and recorded in the readiness document: the per-device
`apple-touch-startup-image` splash matrix and store-listing icon sizes.

## 4. Viewport and theme metadata

The Next `viewport` export in `app/layout.tsx` MUST set:

- `viewportFit: "cover"` — prerequisite for `env(safe-area-inset-*)` to resolve
  to non-zero values (FR-032).
- `themeColor` matching the manifest's `theme_color`.
- It MUST NOT set `maximumScale` or `userScalable: false` — disabling zoom
  fails WCAG AA and the Phase 14 accessibility posture.

## 5. Install affordance behaviour

| State | Behaviour |
|---|---|
| Prompt available (platform fires an install-prompt event) | Show a dismissible in-page banner/card; activating it triggers the platform prompt |
| Installation is manual (no prompt event, but the platform supports installing) | Show the same banner with translated add-to-home-screen instructions instead of a prompt trigger (FR-006a) |
| Already installed (running standalone, or the platform reports installed) | Show nothing |
| Installation unsupported | Show nothing — no dead control (FR-005) |
| Dismissed this session | Do not re-show the banner; the Settings entry remains available |

Additional rules:

- The affordance MUST NOT be a modal or blocking overlay and MUST NOT obstruct
  the primary task (FR-005).
- A permanent install entry MUST exist in Settings, following the same state
  table (FR-005).
- All affordance text MUST come from `messages/{ar,en}.json` and render with
  correct direction (FR-041).

## 6. Verification

| # | Assertion | Mode |
|---|---|---|
| M-1 | `GET /manifest.webmanifest` returns 200 with `id`, `name`, `short_name`, `description`, `start_url`, `scope`, `display: "standalone"`, `background_color`, `theme_color` present | Automated |
| M-2 | Every declared icon URL returns 200 with the declared MIME type and dimensions | Automated |
| M-3 | Exactly one icon declares `purpose: "maskable"` | Automated |
| M-4 | `background_color` and `theme_color` equal the corresponding design-token values | Automated |
| M-5 | The rendered document contains a `<link rel="manifest">` and a `<meta name="theme-color">` with the matching value | Automated |
| M-6 | The document does not disable user scaling | Automated |
| M-7 | With the app reported as installed/standalone, the install banner is absent | Automated |
| M-8 | After dismissing the banner, it does not reappear on navigation within the session, and the Settings entry is still present | Automated |
| M-9 | On a real supported device: install, launch from the home screen, confirm standalone display, correct icon and name, branded launch appearance, correct direction, and a resumed session — in both locales | **Manual** |
