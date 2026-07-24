# Contract: Mobile Navigation, Capture, and Touch Interaction

**Feature**: `015-pwa-mobile-readiness` | **Covers**: FR-016 – FR-022, FR-030 – FR-037, SC-005 – SC-007

## 1. Bottom navigation

| Rule | Requirement |
|---|---|
| N-1 | Rendered below the `lg` breakpoint only; the existing desktop sidebar is unchanged above it |
| N-2 | Carries the first four **role-permitted** destinations from the existing `navItems` array (`components/layout/WorkspaceShell.tsx:17`), plus a "more" entry |
| N-3 | The "more" entry opens the existing `MobileNavDrawer` containing the remaining permitted destinations and the quick actions |
| N-4 | Role filtering is unchanged — a destination the role cannot access appears in neither the bar nor the drawer (FR-038, FR-039) |
| N-5 | Uses logical CSS properties so ordering mirrors automatically for RTL and LTR (FR-031) |
| N-6 | Applies `padding-block-end: env(safe-area-inset-bottom)` so the home indicator does not overlap it (FR-032) |
| N-7 | The active destination is visually indicated **and** exposed to assistive technology (`aria-current="page"`) |
| N-8 | Every item is a real link, keyboard focusable, with a visible focus state |
| N-9 | Page content receives bottom padding equal to the bar's height so the bar never occludes the last row or a primary action |

## 2. Safe areas and viewport

| Rule | Requirement |
|---|---|
| S-1 | `viewportFit: "cover"` is set in the Next `viewport` export (prerequisite for non-zero insets) |
| S-2 | The application shell applies `env(safe-area-inset-*)` on all four sides so content clears notches and rounded corners in portrait **and** landscape (FR-032) |
| S-2a | Horizontal safe-area padding MUST use **physical** properties (`padding-left`/`padding-right`). `env()` inset values are physical, so pairing them with logical `padding-inline-start`/`-end` swaps them under RTL and clips content on the notched side in Arabic landscape. Vertical padding MAY use logical `padding-block-start`/`-end`, which map to top/bottom in both locales' horizontal-tb writing mode |
| S-3 | Full-height overlays (dialog, drawer, sheet) apply the same insets |
| S-4 | Full-height layouts use `dvh` rather than `vh`, so the on-screen keyboard resizing the visual viewport does not push the primary action off-screen (FR-033) |
| S-5 | Zoom MUST NOT be disabled (no `maximumScale`/`userScalable: false`) |

## 3. Keyboard-aware forms

| Rule | Requirement |
|---|---|
| K-1 | With the on-screen keyboard open, the focused field and the primary submit action remain visible and reachable (FR-033) |
| K-2 | Focusing a field scrolls it into view when it would otherwise be obscured |
| K-3 | Numeric fields keep the appropriate mobile keyboard already established in Phase 14 (`inputMode`) — unchanged |
| K-4 | Orientation change mid-task preserves in-progress form input (FR-036) — form state lives in React, never in layout-dependent DOM state |

## 4. Touch targets and dismissal

| Rule | Requirement |
|---|---|
| T-1 | Every interactive control measures at least 44×44px (FR-034) |
| T-2 | Adjacent controls have enough spacing that an intended tap cannot trigger a neighbour |
| T-3 | Dialogs, sheets, and drawers close on their dismiss control and on the device back gesture, without navigating away from the underlying screen (FR-035) |
| T-4 | Dismissal returns focus to the control that opened the overlay |

## 5. Receipt capture and upload

| Rule | Requirement |
|---|---|
| C-1 | The upload flow offers **two** sources: capture a new photo, and select an existing image or PDF (FR-016) |
| C-2 | Capture uses `<input type="file" accept="image/*" capture="environment">` — no `getUserMedia`, no custom camera UI, no client-side image processing |
| C-3 | The capture control renders only when `"capture" in document.createElement("input")` **and** `matchMedia("(pointer: coarse)").matches`; otherwise only the picker is shown, with no dead control (FR-020) |
| C-4 | After capture or selection, a preview shows the file name and size, plus an image thumbnail via an object URL that MUST be revoked on replace and on unmount (FR-017) |
| C-5 | The user can replace or remove the staged file before confirming (FR-017) |
| C-6 | A cancelled capture leaves the form unchanged with no partial file staged (FR-022) |
| C-7 | Upload shows progress with a descriptive label, and the confirm control is disabled while in flight so the same file cannot be submitted twice (FR-018) |
| C-8 | Existing Phase 6 validation applies unchanged: 10 MB limit and the PNG/JPEG/WebP/PDF allow-list (`components/files/FileUpload.tsx:14`). A full-resolution photo exceeding the limit produces the existing `errors.fileTooLarge` message before any upload begins (FR-021) |
| C-9 | Upload failure shows an understandable message with no internal identifier, storage token, or stack trace; retry follows the at-most-once rules in `offline-behavior.md` section 6 and yields exactly one stored file (FR-019) |
| C-10 | While offline or degraded, both sources are disabled with an explanation and nothing is staged for later upload (FR-009, FR-010) |

## 6. Core mobile task inventory

All of the following MUST be completable on a phone viewport in **both**
locales (FR-037, SC-006):

1. View remaining balance
2. Add an expense
3. Add income (when the role permits)
4. Upload a receipt
5. Review an AI extraction
6. Switch workspace
7. Filter records
8. Open settings

## 7. Verification

| # | Assertion | Mode |
|---|---|---|
| MI-1 | On a mobile viewport, the bottom nav renders with the role-permitted destinations and a "more" entry; the desktop sidebar is hidden | Automated (both locales) |
| MI-2 | The active destination carries `aria-current="page"` and a visible indicator | Automated |
| MI-3 | In Arabic the bar's item order and the drawer's open side are mirrored relative to English | Automated |
| MI-4 | A Viewer role sees no destination or action their role forbids, in bar or drawer | Automated |
| MI-5 | Every interactive control on the audited mobile screens has a bounding box of at least 44×44px | Automated |
| MI-6 | Content is not occluded by the bottom nav — the last list row and the primary action remain reachable | Automated |
| MI-7 | The capture control is present on a coarse-pointer profile and absent on a desktop profile | Automated |
| MI-8 | Selecting a file shows the preview with name and size, and removing it clears the staged file | Automated |
| MI-9 | An induced upload failure followed by one retry results in exactly one stored file | Automated |
| MI-10 | Each of the eight core tasks completes on a mobile viewport in both locales | Automated |
| MI-11 | Dialogs and drawers dismiss via control and back gesture without leaving the underlying screen | Automated |
| MI-12 | On a real device: physical camera capture, safe-area rendering in portrait and landscape, keyboard-open form usability, and one-handed reach | **Manual** |
