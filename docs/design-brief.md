# Smart Expense - AI Design Brief

**Document:** Product Design Brief  
**Project:** Smart Expense - AI  
**Status:** Final — Ready for Design System and Prototype  
**Repository:** `D:\claude\smart_expense`  
**Frontend:** Next.js, React, Tailwind CSS, Shadcn UI  
**Primary Language:** Arabic  
**Layout Direction:** RTL  
**Target Market:** Saudi Arabia  
**Design Scope:** Existing MVP frontend only  

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

The MVP is functionally complete. This design phase must improve the visual system, usability, consistency, responsiveness, accessibility, and Arabic RTL experience without changing existing business logic.

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

### 5.7 Existing functionality first

The redesign must improve the current application rather than introduce new product features.

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

- The sidebar should appear on the right in RTL layouts.
- The active page must be visually obvious.
- Navigation labels should use clear Arabic.
- Arabic and English should not be mixed unnecessarily.
- Workspace switching must be clearly separated from user-account actions.

On mobile devices, the sidebar should transform into a drawer or another compact navigation pattern.

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

## 13. Arabic and RTL Requirements

Arabic RTL support is a core design requirement.

The design must correctly handle:

- RTL page structure.
- Right-positioned desktop sidebar.
- Form alignment.
- Table alignment.
- Icons beside Arabic text.
- Breadcrumb direction.
- Dialogs and dropdown menus.
- Pagination controls.
- Date ranges.
- Currency values.
- Mixed Arabic and English content.
- Email addresses.
- API key hints.
- File names.
- Provider names such as OpenAI and Gemini.

Technical values may require isolated LTR rendering inside RTL pages.

Examples include:

- Dates.
- Email addresses.
- File names.
- API key hints.
- URLs.
- Provider identifiers.
- Technical error codes.

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

## 14. Currency and Financial Values

The default currency is Saudi Riyal.

Use one consistent currency format throughout the application.

Preferred display:

```text
1,250.00 ر.س
```

The official Saudi Riyal symbol may be adopted only when:

- The selected font supports it correctly.
- It renders consistently across supported browsers.
- It remains readable in RTL layouts.

Currency formatting must be consistent across:

- Dashboard totals.
- Forms.
- Tables.
- Reports.
- Charts.
- AI review.
- History.

Requirements:

- Use Western digits.
- Use consistent decimal precision.
- Keep the negative sign, amount, and currency indicator visually together.
- Prevent wrapping that separates the symbol from the amount.
- Zero values should remain neutral.
- Positive and negative states must not rely only on color.

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

Components must use shared tokens instead of page-specific styling.

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

## 25. Technical Guardrails

The design phase must not change:

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

These may be considered in future phases.

---

## 27. Prototype Deliverables

The design tool should produce:

1. A complete visual design system.
2. Desktop application shell.
3. Responsive mobile application shell.
4. High-fidelity versions of the main existing screens.
5. Arabic RTL layouts.
6. Component variants and states.
7. Empty, loading, error, and permission states.
8. Responsive page examples.
9. Design tokens.
10. Clear developer handoff documentation.

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
