# Smart Expense - AI Design Brief

**Document:** Product Design Brief  
**Project:** Smart Expense - AI  
**Status:** Phase 11 — In Progress; Design System and Prototype Review  
**Repository:** `D:\claude\smart_expense`  
**Working Product Name:** Smart Expense - AI  
**Frontend:** Next.js 16.x, React, Tailwind CSS, Shadcn UI  
**Default Language:** Arabic  
**Additional Language:** English planned for Phase 12  
**Layout Direction:** RTL for Arabic; LTR for English  
**Primary Market:** Saudi-first  
**Design Scope:** Existing MVP screens plus approved future-state UX
requirements for Phases 12–14  

---

## 1. Product Overview

Smart Expense - AI is a Saudi-first personal expense tracking and smart budgeting application.

It helps individuals, families, couples, and small teams understand:

> How much income came in, how much was spent, and how much remains?

The product supports:

- Income tracking.
- Expense tracking.
- Category management.
- Remaining-balance budgeting.
- Receipt and invoice uploads.
- Optional AI extraction.
- Reports and summaries.
- Financial history.
- Personal and team workspaces.
- Role-based permissions.

The MVP is functionally complete. Phase 11 must improve the visual system,
usability, consistency, responsiveness, accessibility, and Arabic RTL
experience while preparing a developer-ready design direction for:

- Arabic and English localization in Phase 12.
- RTL and LTR layout switching in Phase 12.
- One base currency per workspace in Phase 12.
- Hierarchical income and expense categories in Phase 13.
- Design-system implementation in Phase 14.

Phase 11 must not change production business logic, database behavior, API
contracts, permissions, or financial calculations.

### Roadmap boundaries

- Phase 11 defines and validates the design.
- Phase 12 implements localization and workspace currency.
- Phase 13 implements hierarchical categories.
- Phase 14 implements the approved frontend redesign.
- Phase 15 implements PWA and mobile-readiness behavior.
- Phase 16 delivers the future mobile application.
- Phase 17 handles optional product-support purchases.

PWA installation, native mobile packaging, and product-support purchases are
not implementation deliverables of this design phase.

---

## 2. Design Objective

Create a calm, trustworthy, modern financial workspace that makes daily expense tracking simple and clear.

The interface should help users quickly understand:

- Their current remaining balance.
- Their total income.
- Their total expenses.
- Recent financial activity.
- Spending by category.
- Pending AI extraction reviews.
- Important actions that require attention.

The product should feel like a practical financial assistant, not a complicated accounting system.

---

## 3. Product Personality

The interface should feel:

- Trustworthy.
- Calm.
- Clear.
- Organized.
- Modern.
- Helpful.
- Private and secure.
- Professional without feeling corporate or intimidating.

The design should avoid:

- Excessive visual effects.
- Overly bright colors.
- Crowded dashboards.
- Unnecessary animations.
- Complicated financial terminology.
- Decorative elements that distract from financial information.
- Visual patterns that make the product look like a generic admin template.

---

## 4. Primary Users

### 4.1 Individuals

Users tracking personal income, expenses, receipts, and monthly balance.

### 4.2 Families and couples

Users managing shared household spending through a team workspace.

### 4.3 Small teams

Workspace members recording and reviewing shared expenses while respecting role permissions.

### 4.4 Permission levels

The design must support these roles:

- Owner.
- Admin.
- Member.
- Viewer.

Users should clearly understand which actions are available to them.

Unavailable actions should either:

- Be hidden when they are irrelevant.
- Or appear disabled with a clear explanation when understanding the restriction is useful.

The interface must not show active controls that will always fail because of the user's role.

---

## 5. Core Design Principles

### 5.1 Financial clarity first

The remaining balance, total income, and total expenses must be understandable at a glance.

### 5.2 Manual-first and AI-optional

Manual expense entry must remain simple and prominent.

AI features should appear as optional assistance, not as a requirement for using the product.

### 5.3 Content before decoration

Financial data, records, totals, and actions are more important than decorative elements.

### 5.4 Consistency

Buttons, forms, cards, tables, dialogs, filters, badges, and navigation must behave consistently across all pages.

### 5.5 Safe actions

Destructive actions such as deletion, removal, discard, or leaving a workspace must:

- Be clearly distinguished.
- Require appropriate confirmation.
- Explain the result before completion.

### 5.6 Progressive disclosure

Advanced options should appear only when needed. Main screens should remain simple.

### 5.7 Existing functionality and approved roadmap requirements

The redesign must preserve all existing MVP workflows.

Future requirements from Phases 12 and 13 may be represented in the
prototype to prepare the design handoff, but they must be clearly identified
as future-state behavior and must not be treated as currently implemented
functionality.

---

## 6. Main Application Areas

The design system and prototype must cover the existing frontend areas:

1. Authentication and sign-in.
2. Main dashboard.
3. Income records.
4. Expense records.
5. Add and edit financial record forms.
6. Categories.
7. Receipt and invoice files.
8. AI provider and API key settings.
9. AI extraction status and review.
10. AI extraction review queue.
11. Reports and summaries.
12. Financial history.
13. Workspace switcher.
14. Workspace members and permissions.
15. General settings.
16. Empty states.
17. Loading states.
18. Error states.
19. Permission-denied states.
20. First-run empty workspace experience.

No existing functional page should be omitted.

---

## 7. First-Run and Empty Workspace Experience

The design should provide a helpful first experience without creating a mandatory onboarding wizard.

### 7.1 New account

A new user should quickly understand the main workflow:

1. Add income or expense.
2. See the remaining balance.
3. Optionally upload a receipt for AI extraction.

Optional setup, such as configuring AI keys or customizing categories, should not block the user from reaching the dashboard.

### 7.2 Empty workspace

A workspace with no records should not look broken.

It should show clear actions such as:

- Add your first expense.
- Add your first income, when permitted.
- Upload your first receipt.
- Invite a member, when permitted.

### 7.3 Guidance, not gating

Light guidance is acceptable, such as:

- Empty-state instructions.
- Small contextual tips.
- A short optional checklist.

A mandatory multi-step onboarding wizard is out of scope.

---

## 8. Main Dashboard

The dashboard is the primary application screen.

It should prioritize:

1. Remaining balance.
2. Total income.
3. Total expenses.
4. Selected financial period.
5. Recent records.
6. Spending category summary.
7. Pending AI reviews.
8. Quick actions.

Primary quick actions should include:

- Add expense.
- Add income, when permitted.
- Upload receipt.
- Review pending extraction.

The remaining balance should be the strongest financial element on the page.

The dashboard should not present too many cards with equal visual importance.

---

## 9. Navigation

Desktop navigation should use a clear sidebar designed for Arabic RTL layouts.

The sidebar should support:

- Workspace selection.
- Dashboard.
- Income.
- Expenses.
- Categories.
- Files or receipts.
- AI review.
- Reports.
- History.
- Settings.

Requirements:

- The sidebar must appear on the right in Arabic RTL layouts.
- The sidebar must appear on the left in English LTR layouts.
- The active page must be visually obvious.
- Navigation labels must be fully translated.
- Arabic and English labels must not be mixed unnecessarily.
- Directional icons must adapt when their meaning depends on direction.
- Workspace switching must be clearly separated from user-account actions.
- Language switching must not be confused with workspace switching.

On mobile devices, navigation should transform into a direction-aware drawer
or another compact navigation pattern.

A global search feature and a persistent notification center are out of scope for this redesign.

---

## 10. Visual Direction

Use a modern application interface based on Shadcn UI conventions and reusable Tailwind CSS tokens.

### 10.1 Primary direction

- Light mode is the only mode in scope for this redesign.
- Use generous but efficient spacing.
- Use soft borders instead of excessive shadows.
- Use consistent rounded corners.
- Use calm neutral backgrounds.
- Use emerald or teal as the primary accent family.
- Use red for expenses, destructive actions, and critical errors.
- Use green for income, success, and positive states.
- Use amber for pending and warning states.
- Use blue or neutral colors for informational states.

The interface must remain understandable without relying only on color.

Dark mode is deferred to a future phase.

---

## 11. Design Tokens

These tokens are the initial direction and may be refined during design review.

### 11.1 Color tokens

| Token | Value | Usage |
|---|---:|---|
| Primary / Accent | `#0F7A5C` | Primary actions, links, active navigation |
| Income / Positive | `#16A34A` | Income amounts and success states |
| Expense / Negative | `#DC2626` | Expense amounts and destructive actions |
| Warning / Pending | `#F59E0B` | Pending AI review and warnings |
| Information | `#3B82F6` | Informational states |
| Surface | `#FFFFFF` | Cards, dialogs, table rows |
| Background | `#F8FAFC` | Application background |
| Border | `#E2E8F0` | Borders and dividers |
| Primary Text | `#0F172A` | Headings and financial values |
| Muted Text | `#64748B` | Supporting text and labels |

### 11.2 Typography tokens

Preferred font:

- Tajawal.
- IBM Plex Sans Arabic may be considered if it is already available and performs better in the existing project.

Typography scale:

| Token | Value | Usage |
|---|---|---|
| Page title | `24–28px`, bold | Page headings |
| Section heading | `18–20px`, semibold | Card and section headings |
| Financial value | `20–32px`, semibold | Balance and totals |
| Body / Table | `14–15px`, regular | Forms, tables, descriptions |
| Supporting text | `12–14px`, regular | Metadata and hints |

Financial values should use tabular lining numbers when supported.

### 11.3 Spacing and radius

| Token | Value |
|---|---|
| Spacing scale | `4 / 8 / 12 / 16 / 24 / 32 / 48px` |
| Input and button radius | `8px` |
| Card and dialog radius | `12px` |
| Badge radius | Full pill |
| Mobile breakpoint | `< 768px` |
| Tablet breakpoint | `768–1023px` |
| Desktop breakpoint | `≥ 1024px` |
| Icon library | `lucide-react` |

---

## 12. Typography and Numerals

Arabic typography must be highly readable.

The hierarchy should clearly separate:

- Page titles.
- Section headings.
- Financial values.
- Form labels.
- Table content.
- Supporting descriptions.
- Status text.

Use Western digits by default:

```text
0123456789
```

Use Western digits consistently for:

- Financial values.
- Dates.
- Pagination.
- Charts.
- Reports.
- AI extraction values.

Eastern Arabic digit preferences are out of scope for the current redesign.

---

## 13. Internationalization, Arabic RTL, and English LTR Requirements

Arabic is the default interface language and uses RTL layouts.

English is an optional interface language planned for Phase 12 and uses LTR
layouts.

The design must support:

- A user-level language preference.
- Complete translation of system interface text.
- Direction-aware navigation, forms, tables, dialogs, and pagination.
- Arabic RTL and English LTR application shells.
- Translated system-provided category names.
- User-created category names exactly as entered by the user.
- User-entered merchant names, notes, and descriptions without automatic
  translation.
- Mixed Arabic and English content.
- Directional icons that flip only when their meaning requires it.
- Stable component dimensions when switching languages.
- Longer English and Arabic labels without clipping.

Technical values may require isolated LTR rendering inside both language
layouts.

Examples include:

- Dates.
- Email addresses.
- File names.
- API key hints.
- URLs.
- Provider identifiers.
- Technical error codes.

Western digits remain the default in both languages.

### 13.1 F-001 RTL date display

The known issue `F-001` must be addressed in design and implementation.

Date values must:

- Preserve their correct day, month, and year order.
- Avoid reversed separators.
- Remain readable inside RTL layouts.
- Align consistently in tables, filters, forms, and cards.
- Display correctly on desktop and mobile.

Recommended rendering pattern:

```html
<span dir="ltr">13/07/2026</span>
```

Use one consistent display format:

```text
DD/MM/YYYY
```

Do not rely on browser bidirectional-text heuristics alone.

---

## 14. Workspace Base Currency and Financial Values

Each workspace will have exactly one base currency in Phase 12.

Saudi Riyal is the default base currency.

Requirements:

- Dashboard totals, forms, records, reports, charts, AI review, and history
  must use the selected workspace base currency.
- A financial record must not have an independent currency that differs from
  its workspace.
- Mixed-currency records are out of scope.
- Exchange-rate conversion is out of scope.
- Changing the interface language must not change the workspace currency.
- Switching workspaces must immediately update financial formatting.
- Workspace currency selection must appear in workspace settings.
- Changing the currency of a workspace that already contains records must
  display a clear warning and require confirmation.
- The design must not imply that historical amounts are converted when the
  base-currency setting changes.
- Amount, sign, decimal separators, and currency indicator must remain
  visually grouped.
- Positive and negative states must not rely only on color.

Saudi Riyal example:

```text
1,250.00 ر.س
```

Other currencies must use their approved code or symbol consistently.

The official Saudi Riyal symbol may be adopted only when the selected font
and supported platforms render it correctly.

---

## 15. Forms

Forms should be simple, clear, and optimized for frequent use.

Common fields include:

- Amount.
- Record type.
- Category.
- Merchant or source.
- Date.
- Notes.
- Status.
- Receipt or invoice.
- Workspace.

Requirements:

- Labels must remain visible.
- Required fields must be clear.
- Validation errors must appear close to the relevant field.
- The primary action must be visually obvious.
- Cancel and destructive actions must not compete with the primary action.
- Forms should support keyboard navigation.
- Numeric fields on mobile should open the appropriate keyboard.
- Loading and submission states must prevent duplicate actions.
- Amount, sign, and currency must remain correctly ordered in RTL.
- Technical values should use LTR isolation where needed.

### 15.1 Hierarchical category selection

The future Phase 13 category experience must support:

- Separate category sets for income and expenses.
- One main-category level and one subcategory level.
- Clear distinction between a main category and a subcategory.
- Selection of an appropriate subcategory where available.
- Creation and editing according to role permissions.
- Disabled categories that remain identifiable in historical records.
- Translated names for system-provided categories.
- User-created category names displayed exactly as entered.
- AI suggestions that may recommend a subcategory but never confirm it
  automatically.

Financial forms must show the workspace currency as contextual information
and must not offer a per-record currency selector.

---

## 16. Tables and Record Lists

Financial records must remain easy to scan.

Desktop tables and mobile lists should clearly show:

- Record type.
- Amount.
- Category.
- Merchant or source.
- Date.
- Status.
- User or actor, when relevant.
- Available actions.

Requirements:

- Desktop layouts may use tables.
- Mobile layouts should convert complex tables into cards or compact rows.
- Avoid forcing excessive horizontal scrolling on mobile.
- Filters, search fields already present, pagination, and date controls must remain consistent.
- Dates and financial values must remain directionally correct.
- Important row actions should remain reachable without visual clutter.
- Empty, loading, and error states must be defined.
- Category columns should show both the main category and subcategory where
  applicable.
- System-provided category names should follow the selected interface
  language.
- User-created category names must not be automatically translated.
- Currency formatting must follow the selected workspace.
- Changing interface language must not alter stored financial values.

---

## 17. Reports and Charts

Reports may include:

- Income total.
- Expense total.
- Remaining balance.
- Category breakdown.
- Spending trend.
- Top merchants.
- Team activity.
- Pending AI reviews.

Charts should support the information rather than dominate the page.

Requirements:

- Clear Arabic labels.
- Accessible tooltips.
- Consistent currency formatting.
- Responsive behavior.
- Readable empty states.
- Textual summaries or supporting data for accessibility.
- No three-dimensional charts.
- No excessive gradients.
- No unnecessary animation.
- Category reports must aggregate by main category and allow drill-down into
  subcategories.
- Report period controls must support current, previous, and custom periods.
- Custom ranges of 31 days or fewer should use daily trend presentation.
- Longer supported ranges should use monthly trend presentation.
- Report labels must adapt fully to Arabic RTL and English LTR.
- All report values must use the workspace base currency.
- Reports must never imply currency conversion.

Exporting, printing, PDF, Excel, and CSV features are out of scope for this redesign.

---

## 18. AI Features

AI features are optional and should feel integrated with the product.

The design must clearly represent these states:

- Not started.
- Processing.
- Ready for review.
- Confirmed.
- Failed.
- Discarded.

AI category suggestions may include a main category and subcategory after
Phase 13, but the user must review and confirm the selection.

When extracted currency information conflicts with the workspace base
currency, the future design should present a clear mismatch warning rather
than implying automatic conversion. Implementation of this behavior requires
an approved Phase 12 specification and backend support.

AI-generated values must never appear as confirmed financial records before user confirmation.

The AI review screen must clearly distinguish:

- Extracted suggestions.
- Editable values.
- Original receipt.
- Confirmation action.
- Discard action.
- Error information when available.

### 18.1 AI failure states

When supported by the existing API, failure messages should distinguish between:

- Invalid or expired API key.
- Provider quota exceeded.
- Unreadable receipt or image.
- Provider service failure.
- Generic extraction failure.

Each state should provide a clear next step.

The design must not assume error details that the current API does not provide.

### 18.2 API key presentation

API keys must remain masked.

The interface must never imply that users can reveal or retrieve a complete key after saving.

---

## 19. Workspace Experience

The current workspace must always be clear.

The workspace switcher should show:

- Workspace name.
- Workspace type, when relevant.
- Selected workspace.
- A clear way to switch.

Workspace switching must not be confused with account switching.

Permission-related states should explain why an action is unavailable.

Role-based differences must remain consistent across:

- Dashboard actions.
- Income entry.
- Expense entry.
- Member management.
- AI settings.
- AI review.
- Workspace settings.

Language preference belongs to the user.

Base currency belongs to the workspace.

The interface must make this distinction clear:

- Switching language changes interface text and direction.
- Switching language does not change financial values or workspace currency.
- Switching workspace may change the displayed currency.
- Workspace currency management must appear only to authorized roles.

---

## 20. Components Required in the Design System

The design system should define reusable versions of:

- Application shell.
- Desktop sidebar.
- Mobile navigation.
- Workspace switcher.
- Top header.
- Page heading.
- Financial summary cards.
- Standard information cards.
- Buttons.
- Icon buttons.
- Inputs.
- Amount input.
- Date input or picker.
- Select and combobox.
- Text area.
- File upload.
- Tabs.
- Tables.
- Mobile record cards.
- Filters.
- Existing search fields.
- Status badges.
- Alerts.
- Toast notifications.
- Dialogs.
- Confirmation dialogs.
- Dropdown menus.
- Pagination.
- Skeleton loading states.
- Empty states.
- Error states.
- Permission-denied states.
- Charts.
- Receipt preview.
- AI review form.
- Language switcher.
- Workspace base-currency selector.
- Direction-aware application shell.
- Hierarchical category picker.
- Main-category and subcategory presentation.
- Currency-change warning dialog.
- Bilingual validation and empty-state variants.

Components must use shared tokens instead of page-specific styling.

Payment or product-support components are not part of this design phase; they belong to Phase 17.

A persistent notification center, email notification settings, and global search are not part of this design phase.

---

## 21. Interaction States

Every interactive component should define:

- Default.
- Hover.
- Focus.
- Active.
- Selected.
- Disabled.
- Loading.
- Error.
- Success.

Requirements:

- Keyboard focus must be clearly visible.
- Buttons must not change size during loading.
- Loading labels should explain what is happening when useful.
- Long-running actions such as upload and AI extraction must show progress or status.
- Disabled permission-based actions should explain the restriction where appropriate.
- Destructive actions must use confirmation dialogs.

---

## 22. Responsive Design

The design must support:

- Mobile phones.
- Tablets.
- Laptop screens.
- Large desktop screens.

Mobile design must be treated as a deliberate layout, not as a scaled-down desktop screen.

Important mobile tasks must remain easy:

- Viewing remaining balance.
- Adding an expense.
- Adding income, when permitted.
- Uploading a receipt.
- Reviewing extracted data.
- Switching workspace.
- Filtering records.

Primary actions should remain reachable without unnecessary scrolling.

Complex tables should become cards or compact lists on mobile.

The responsive design should be ready for later PWA implementation, including:

- Mobile-safe navigation.
- Touch-friendly financial forms.
- Camera and file-upload entry points.
- Appropriate device safe-area spacing.
- Reliable loading and reconnect states.

PWA installation prompts, offline synchronization, and native application
packaging are implementation concerns for Phases 15 and 16 and are not part
of Phase 11.

---

## 23. Accessibility

The interface should target WCAG AA accessibility where practical.

Requirements include:

- Body-text contrast of at least `4.5:1`.
- Visible focus states.
- Keyboard navigation.
- Proper form labels.
- Accessible dialogs.
- Meaningful icon labels.
- Error messages that do not rely only on color.
- Charts with textual summaries or supporting data.
- Touch targets of at least `44 × 44px`.
- Sufficient spacing between adjacent controls.
- Screen-reader-friendly status updates for loading and completed actions.

---

## 24. Security and Privacy Presentation

The design should reinforce trust without making exaggerated security claims.

It should clearly communicate:

- Private workspace data.
- Role-based permissions.
- Masked AI API keys.
- User confirmation before AI-created expenses.
- Safe deletion confirmations.
- Receipt and invoice privacy.

Do not display:

- Internal database identifiers.
- Access tokens.
- Vault values.
- Full API keys.
- Internal implementation details.

Privacy mode, session timeout screens, OTP, and 2FA are out of scope for this redesign.

---

## 25. Technical and Phase Guardrails

Phase 11 may document and prototype future UX requirements for Phases 12–14,
but it must not directly change production:

- Financial calculation rules.
- Confirmed-only totals.
- Role permissions.
- Supabase authentication.
- Database schema.
- API contracts.
- AI provider behavior.
- File storage rules.
- History append-only behavior.
- Workspace isolation.
- Existing business logic.

Every future-state screen or component must be labeled with its target phase
and must not be presented as currently implemented behavior.

The final implementation must continue using:

- Next.js.
- React.
- Tailwind CSS.
- Shadcn UI.
- Existing FastAPI endpoints.
- Existing Supabase authentication and data services.

The redesign should evolve existing components instead of introducing an unrelated frontend framework.

---

## 26. Explicitly Out of Scope

The following features are not part of this redesign:

- Dark mode.
- Global application search.
- Persistent notification center.
- Email notifications.
- Notification settings.
- Budget-threshold alerts.
- Report export.
- PDF export.
- Excel export.
- CSV export.
- Print-specific report views.
- Privacy mode.
- Eastern Arabic numeral preference.
- OTP.
- 2FA.
- Session timeout redesign.
- New backend endpoints.
- Database changes.
- Changes to financial logic.
- Changes to role permissions.
- Mixed-currency financial records.
- Currency conversion and exchange rates.
- Per-record currency selection.
- PWA installation implementation.
- Offline financial record creation or synchronization.
- Native Android or iOS packaging.
- App-store publishing.
- Product-support purchase screens.
- Payment checkout.
- Paid tiers or mandatory subscriptions.
- Final product renaming and final logo production.

These may be considered in future phases.

---

## 27. Prototype Deliverables

The design tool should produce:

1. A complete visual design system.
2. Arabic RTL desktop and mobile application shells.
3. Representative English LTR application shells.
4. High-fidelity versions of all existing MVP screens.
5. Language-switching behavior and bilingual component examples.
6. Workspace base-currency settings and formatting examples.
7. Hierarchical income and expense category examples.
8. Component variants and interaction states.
9. Empty, loading, error, and permission states.
10. Responsive desktop, tablet, and mobile examples.
11. Design tokens.
12. Developer handoff notes mapping future-state designs to Phases 12–14.

The prototype should use:

- Realistic Arabic labels.
- Realistic Saudi Riyal values.
- Realistic dates.
- Realistic financial records.
- Existing product concepts and roles.

It should not rely only on generic English placeholder text.

---

## 28. Design Acceptance Criteria

The design is ready for implementation when:

- Main existing user flows can be completed in the prototype.
- All important existing pages are represented.
- Arabic RTL layouts are correct.
- Dates display correctly in RTL contexts.
- Desktop and mobile layouts are defined.
- Financial totals have a clear visual hierarchy.
- Forms and tables are consistent.
- Role-restricted actions are represented correctly.
- AI review states are understandable.
- Pending AI extraction is not visually confused with a confirmed transaction.
- Empty, loading, error, and permission states are included.
- Components are reusable and documented.
- The design does not require backend business-logic changes.
- Body-text contrast meets WCAG AA.
- Touch targets are at least `44 × 44px`.
- `F-001` is verified in tables, filters, forms, and cards.
- Dates are tested in Chrome and at least one mobile Arabic RTL environment.
- A first-time user can add an expense and understand the remaining balance without external instruction.
- A Viewer or Member does not encounter an unexplained permission failure.
- Representative English LTR layouts are reviewed.
- Language switching does not break navigation, forms, tables, or dialogs.
- User language and workspace currency are presented as separate settings.
- All financial screens follow the workspace base currency.
- No design implies mixed currencies or exchange-rate conversion.
- Income and expense category trees are visually separate.
- Main categories and subcategories are understandable in forms and reports.
- Current MVP behavior and future Phase 12–14 behavior are clearly labeled.
- The design does not include Phase 17 product-support purchase flows.

---

## 29. Success Criteria

The redesign is successful when:

- Users can understand the financial state of the workspace at a glance.
- Remaining balance is visually dominant and easy to interpret.
- Income and expense values are distinguishable without relying only on color.
- Adding an expense is fast and straightforward.
- Uploading and reviewing a receipt is clear.
- Pending AI data is never mistaken for confirmed financial data.
- Arabic RTL layouts feel intentional rather than mirrored.
- Dates cannot be misread because of RTL direction.
- Desktop and mobile experiences feel consistent.
- The application looks like one coherent product rather than separate pages.

---

## 30. Final Design Direction

Smart Expense - AI should look like a focused financial workspace built for everyday use in Saudi Arabia.

The application should make users feel that their finances are:

- Understandable.
- Organized.
- Secure.
- Under control.

The user's financial information must remain the main visual focus of every screen.
