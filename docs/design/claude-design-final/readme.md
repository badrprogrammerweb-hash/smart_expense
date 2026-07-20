# Smart Expense - AI — Design System

## Company & product context

Smart Expense - AI is a Saudi-first, Arabic-RTL personal expense tracking and smart budgeting app for individuals, families/couples, and small teams. Core loop: track income and expenses, see remaining balance, optionally extract receipts with AI, review AI suggestions before they become real records, and view reports/history inside a role-based workspace (Owner/Admin/Member/Viewer).

This is a **redesign of an existing MVP**, not a new product. Existing stack: Next.js, React, Tailwind CSS, Shadcn UI, FastAPI backend, Supabase auth. Business logic, permissions, and API contracts are frozen — this system only redefines the visual/UX layer.

**Sources provided:** a written Product Design Brief only (no codebase or Figma attached — repo path referenced was `D:\claude\smart_expense`, a local path not accessible from here). Every token, component, and screen below was authored from that brief's explicit specs (Section 11 tokens, Section 20 component list, Section 6 screen inventory). If the real codebase or a Figma file becomes available, re-derive tokens/components from it and treat this system as the placeholder it is.

**Fonts:** the brief calls for Tajawal (primary) or IBM Plex Sans Arabic. No font files were attached, so both are loaded from Google Fonts CDN (`tokens/fonts.css`) — flagged here per instructions. Swap in licensed font files if you have them.

**No logo was provided.** Wherever a mark would go, the system renders the wordmark "Smart Expense" in Tajawal Bold. Do not invent a logo — attach one and this system will adopt it.

---

## Content fundamentals

**Language & direction:** Arabic is the only UI language; layout is RTL end-to-end (sidebar on the right, forms/tables mirrored, breadcrumbs reversed). English only appears where it must — provider names (OpenAI, Gemini), file names, emails, URLs — and those runs are wrapped `dir="ltr"` so they don't reverse.

**Numerals:** Western digits (`0123456789`) everywhere — amounts, dates, pagination, charts. Never Eastern Arabic-Indic digits.

**Tone:** calm, direct, respectful — like a competent financial assistant, not a salesperson and not a strict accountant. Short sentences. No hype, no exclamation points, no jokes.

**Voice examples (Arabic → intent):**
- Empty state: "لا توجد مصاريف بعد" ("No expenses yet") — factual, not apologetic.
- Primary CTA: "إضافة مصروف" ("Add expense") — verb-first, imperative, no filler.
- AI review: "راجع القيم قبل التأكيد" ("Review the values before confirming") — instructive, sets expectation that AI is not final.
- Destructive confirm: "سيتم حذف هذا السجل نهائيًا. لا يمكن التراجع عن هذا الإجراء." ("This record will be permanently deleted. This cannot be undone.") — states the consequence plainly, no euphemism.
- Permission-denied: "هذا الإجراء متاح فقط لمالك مساحة العمل أو المشرف." ("This action is only available to the workspace owner or admin.") — explains *why*, never a bare "access denied".

**Casing:** Arabic has no case, so hierarchy comes from weight/size, not caps. Any Latin-script UI text (rare — provider names, units) stays in natural case, never uppercased for style.

**Numbers/currency in copy:** always Western digits + `ر.س` suffix, e.g. `1,250.00 ر.س`, never a bare number or a symbol-first format.

**Emoji:** never used. This is a financial tool; icons (lucide-react) carry meaning instead.

**Vibe in one line:** quiet competence — the interface gets out of the way of the numbers.

---

## Visual foundations

**Color:** one accent family (emerald `#0F7A5C`) for primary actions/links/active nav. Meaning-carrying colors are separate from the accent: green for income/success, red for expense/destructive, amber for pending/warning, blue for informational. Every colored state also carries a label or icon — color is never the only signal (accessibility + colorblind-safety). Light mode only; no dark theme.

**Type:** Tajawal across the whole UI (one Arabic family, several weights) — no serif, no decorative display face. Financial values get their own scale (20–32px, semibold, tabular numerals) so amounts always outrank surrounding labels. Body/table text sits at 14–15px; supporting metadata drops to 13px.

**Spacing:** 4/8/12/16/24/32/48px scale, generous but efficient — enough air to breathe, never enough to force scrolling for primary tasks. Dashboard cards are not equal-weight; remaining balance is deliberately the largest element on the page.

**Backgrounds:** flat, calm neutrals only (`#F8FAFC` app background, white cards). No photography, no illustration, no full-bleed imagery, no repeating patterns/textures, no gradients anywhere in-product. This is a deliberate contrast with generic "SaaS admin template" visuals.

**Borders over shadows:** cards and inputs are defined mainly by a 1px `#E2E8F0` border; shadow is reserved for things that float above the page (dropdowns, dialogs, toasts) and stays soft (`--shadow-card`, `--shadow-dialog` — low opacity, no hard drop shadows).

**Radius:** 8px on controls (buttons, inputs), 12px on cards/dialogs, full pill on badges/status chips. Consistent everywhere — no mixed radii on the same page.

**Animation:** minimal and functional only — short (120–160ms) ease transitions on hover/focus/press; no bouncing, no entrance choreography, no decorative motion. Long-running actions (upload, AI extraction) show a determinate/indeterminate progress state, not a spinner-and-hope.

**Hover / press states:** hover darkens a filled surface one step (`--color-primary-hover`) or tints a neutral surface (`--color-surface-hover`); press scales interactive elements to 0.98 and steps the color one more shade darker. No lightening on hover, no glow.

**Focus:** a visible 3px soft ring in the accent color (`--shadow-focus`) on every interactive element — required for keyboard users, never suppressed.

**Elevation order:** page → card (border, no shadow) → dropdown/menu (border + soft shadow) → dialog (soft shadow + scrim `rgba(15,23,42,.45)`) → toast (soft shadow, floats above everything). No blur/glassmorphism anywhere.

**Imagery:** none in-product — receipts/invoices are the only "imagery" surface (user photos/scans), shown true-to-source in a neutral frame, never stylized.

**Numerals & directional isolation:** any technical or Latin-script token (dates, emails, API key hints, file names, provider names) is wrapped in `<span dir="ltr">` — this is the fix for known issue F-001 (reversed date separators in RTL). Dates always render `DD/MM/YYYY` in a single consistent format, isolated LTR, never left to bidi heuristics.

**Cards:** white surface, 1px `--color-border`, 12px radius, `--shadow-card` (barely-there), 16–24px internal padding. No colored left-border accent strip — that pattern is deliberately avoided.

---

## Iconography

**Library:** [lucide-react](https://lucide.dev) per the brief — consistent 1.5–2px stroke, no fills, 20–24px default size. Loaded from CDN (`unpkg.com/lucide-static`) in UI kit screens since no local icon sprite/font was attached; substitution is flagged here. No emoji, no unicode glyphs used as icons.
No SVGs are hand-drawn in this system — every icon reference in components/UI kits pulls from the Lucide set by name.

---

## Intentional additions

The brief's Section 20 list is the component inventory; nothing beyond it was added except:
- **Skeleton** — implied by "Skeleton loading states" in the same list, split into row/card/text variants for reuse.
- **Icon** wrapper — thin helper so components reference Lucide icons by name consistently (not a new visual primitive).

---

## Index

- `styles.css` — single import entry (link this one file).
- `tokens/` — colors, typography, spacing/radius/breakpoints, shadows, fonts (Google-hosted Tajawal/IBM Plex Sans Arabic).
- `components/` — grouped React primitives (see each directory's `.prompt.md` for usage):
  - `core/` — Button, IconButton, Badge, Alert, Toast
  - `forms/` — Input, AmountInput (currency prop), DateField (inline calendar popover), DateInput, Select, Textarea, FileUpload
  - `overlays/` — Dialog, ConfirmDialog, DropdownMenu, CategoryPickerDialog (Phase 13 future-state)
  - `navigation/` — Sidebar, MobileNav, WorkspaceSwitcher, TopHeader, PageHeading, Tabs, LanguageSwitcher (Phase 12 future-state)
  - `data/` — Table, MobileRecordCard, Pagination, FilterBar, SearchField
  - `feedback/` — EmptyState, ErrorState, PermissionDeniedState, Skeleton
  - `finance/` — SummaryCard, InfoCard, StatusBadge, ReceiptPreview, AIReviewForm, Chart
- `guidelines/` — foundation specimen cards (colors, type, spacing, radius, shadow, RTL/date pattern).
- `ui_kits/app/` — click-through recreation of the product (auth, dashboard, income/expenses, forms, categories, receipts, AI review, reports, history, workspace/members, settings, empty/error/permission states).
- `SKILL.md` — portable skill file for Claude Code / other agents.

## Caveats

- No codebase or Figma was attached — every value here is inferred from the written brief, not verified against real code. Treat as v0.
- No logo attached — wordmark only.
- Fonts are Google-Fonts-hosted substitutes, not the original licensed files.
