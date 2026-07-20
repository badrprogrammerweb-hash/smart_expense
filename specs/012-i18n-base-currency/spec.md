# Feature Specification: Internationalization and Workspace Currency

**Feature Branch**: `012-i18n-base-currency`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "Phase 12 — Internationalization and Workspace Currency. Add Arabic and English interface support with complete RTL and LTR layout switching. Store the preferred interface language per user. Add one base currency per workspace (Saudi Riyal remains the default). Format money, numbers, and dates according to language and currency. Update frontend, backend contracts, and tests where required. No exchange-rate conversion or mixed-currency accounting is introduced."

## Overview

Smart Expense - AI already ships a working Arabic/English interface with
right-to-left and left-to-right layout switching (built during earlier phases):
a locale-prefixed route tree, a language switcher on the Settings page, and
localized strings across every core surface. Two gaps remain against the
Phase 12 exit criteria in `docs/implementation-plan.md`:

1. **Language preference is not durably stored per user.** Today the selected
   language survives only as a browser cookie set by the routing middleware.
   It does not follow the user across devices or browsers, and there is no
   server-side record of "this user prefers Arabic."
2. **There is no workspace currency.** SAR is hard-coded as the only allowed
   currency at every layer: a database `CHECK` constraint on `incomes` and
   `expenses`, `Literal["SAR"]` types in the backend API schemas, matching
   hard-coded `"SAR"` literal types in the frontend API client, and a
   hard-coded currency code inside the money-formatting utility. Workspaces
   have no `currency` column at all.

This phase closes both gaps: it adds durable per-user language-preference
storage, introduces exactly one base currency per workspace (chosen from a
supported list, defaulting to and remaining SAR unless changed), and makes
money, number, and date formatting consistently reflect the acting user's
language and the workspace's currency across every surface that displays
financial data (dashboard, records, reports, AI review, and history).

**Explicit non-goals carried over from the constitution**: this phase does
**not** add exchange-rate conversion, does not allow a single workspace to
hold records in more than one currency, and does not add a second calendar
system (for example Hijri) — date formatting changes are limited to
locale-appropriate ordering/script of the existing Gregorian calendar.

This phase supersedes the "SAR-only reporting" scope boundary recorded in
`specs/009-reports-summaries-history/spec.md` (its FR-034 and the Constitution
Check note in its `plan.md`): reports become currency-aware based on the
workspace's single configured currency, not multi-currency.

## Clarifications

### Session 2026-07-20

- Q: Once a workspace has income or expense records, can its base currency
  still be changed? → A: No — the currency is locked as soon as the workspace
  has its first confirmed or draft income/expense record; before that, the
  Owner can change it freely. This is the simplest rule that prevents mixed-
  currency records and exchange-rate ambiguity without adding a migration/
  conversion feature.
- Q: Who may set or change a workspace's base currency? → A: Owner only,
  consistent with the existing pattern for workspace-level settings (e.g. the
  `auto_delete_after_extraction` setting), since currency affects every
  member's financial data.
- Q: What is the supported currency list? → A: A fixed, curated list headed by
  SAR (the default) plus commonly needed currencies for the product's Gulf-
  first, small-team audience: SAR, USD, EUR, GBP, AED, EGP, KWD, QAR, BHD, OMR.
  The list is plain reference data (not a structural change) and MAY be
  extended in a later phase without revisiting this spec.
- Q: What happens to a user who has never set a language preference? → A: The
  interface falls back to the existing application default locale behavior
  (unchanged by this phase); this phase only adds durable storage and
  precedence for an explicitly chosen preference, it does not change what
  happens before a user ever chooses one.
- Q: Does the workspace currency change what currency code is stored on new
  income/expense records? → A: Yes — new records are created using the
  workspace's current currency; the per-record currency column stays, but its
  allowed value is the workspace's configured currency instead of a fixed
  `SAR` literal.
- Q: Does an unconfirmed AI extraction draft (not yet an income/expense
  record) count toward locking the workspace's currency? → A: No — only an
  actual row in the income/expense tables locks the currency; unconfirmed AI
  drafts remain discardable/editable and MUST NOT restrict the Owner's
  ability to change currency before anything is actually confirmed.
- Q: Does the currency lock check consider soft-deleted income/expense rows,
  or only currently-active ones? → A: It considers every row the workspace
  has ever had, including soft-deleted ones — once a workspace has recorded
  its first income or expense (even if later deleted), its currency is
  permanently locked. This prevents "delete everything to unlock currency" as
  a loophole and matches the constitution's rule that deleted records are
  retained for history/traceability.
- Q: When a user explicitly navigates to a specific language (e.g. via the
  language switcher or a direct locale URL) while a different language is
  stored as their account preference, which one wins for that view? → A: The
  explicit, in-session choice always renders immediately (matching today's
  behavior), and selecting a language through the switcher also updates the
  stored account preference to match. The stored preference is only used to
  choose the starting locale on a fresh sign-in/load when no explicit locale
  choice is already present in the current session.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Language preference follows the user (Priority: P1)

A user selects Arabic or English in Settings, then signs in later from a
different browser or device. The interface opens in the language they chose,
not the browser/cookie default, because the preference is stored against
their account.

**Why this priority**: Interface language switching already works within a
single browser session; without durable, per-user storage the exit criterion
"users can switch between Arabic and English" is only partially met — the
choice does not travel with the user, which is the concrete gap this phase
exists to close.

**Independent Test**: Sign in as a user, set the language to Arabic, sign out,
clear cookies (or sign in from a different browser/session), sign back in, and
confirm the interface opens in Arabic without re-selecting it.

**Acceptance Scenarios**:

1. **Given** a signed-in user with no stored language preference, **When**
   they select Arabic in Settings, **Then** the interface switches to Arabic/
   RTL immediately and the preference is durably stored against their account.
2. **Given** a user who previously stored an Arabic preference, **When** they
   sign in again from a session with no matching cookie (new device/browser),
   **Then** the interface opens in Arabic without requiring them to
   re-select it.
3. **Given** a user changes their stored preference from Arabic to English,
   **When** they reload or sign in again anywhere, **Then** the interface
   consistently opens in English until changed again.
4. **Given** a user has never chosen a language, **When** they use the app,
   **Then** the existing default-locale behavior applies unchanged.

---

### User Story 2 - Workspace Owner sets the workspace's base currency (Priority: P1)

A workspace Owner opens Settings and chooses their workspace's base currency
from a supported list (SAR remains the default for new workspaces). Every
income and expense subsequently recorded in that workspace uses that
currency, and every financial surface in the workspace displays amounts in
that currency.

**Why this priority**: "Each workspace has exactly one base currency" is an
explicit exit criterion and today is impossible — currency is hard-locked to
SAR in the database and in every schema layer. This is the other concrete gap
the phase must close, and it is independently valuable and testable on its
own.

**Independent Test**: As an Owner, change a brand-new workspace's currency
from SAR to another supported currency before adding any records, add an
income and an expense, and confirm both are created in the new currency and
every total/report in that workspace displays in that currency. Then confirm
a Non-Owner cannot change it, and confirm the currency becomes locked once a
record exists.

**Acceptance Scenarios**:

1. **Given** a new workspace with no income/expense records, **When** the
   Owner selects a supported currency other than SAR, **Then** the workspace's
   base currency updates and is reflected wherever it is shown.
2. **Given** a workspace whose base currency was just changed, **When** the
   Owner or another member adds an income or expense, **Then** the new record
   is created using the workspace's current base currency.
3. **Given** a workspace that already has at least one income or expense
   record, **When** the Owner attempts to change the currency, **Then** the
   change is rejected with a clear explanation that currency is locked once
   records exist.
4. **Given** a workspace, **When** an Admin, Member, or Viewer attempts to
   change the currency, **Then** the attempt is denied by the backend.
5. **Given** a workspace created before this phase shipped, **When** it is
   loaded after the change, **Then** its base currency reads as SAR with no
   data migration required and no disruption to existing records.

---

### User Story 3 - Money, numbers, and dates format consistently everywhere (Priority: P2)

A user viewing the dashboard, income/expense records, reports, AI extraction
review, and history sees every amount formatted using the workspace's base
currency (correct symbol/code and decimal handling) and every amount, count,
and date formatted according to their selected interface language — with the
same rules applied consistently across all of these surfaces.

**Why this priority**: This is the payoff of Stories 1 and 2 — the exit
criterion "currency formatting is consistent across records, dashboard,
reports, AI review, and history" is only met once formatting is driven by
workspace currency and user language everywhere rather than a single
hard-coded currency constant.

**Independent Test**: In a workspace configured with a non-SAR currency, view
the dashboard, an income/expense list, a report, an AI extraction review
screen, and the history log in both Arabic and English, and confirm every
money value uses the workspace's currency and every number/date follows the
selected language's formatting conventions, with no surface left showing the
old hard-coded SAR formatting.

**Acceptance Scenarios**:

1. **Given** a workspace with a non-SAR base currency, **When** the dashboard,
   records list, reports, AI review, and history are viewed, **Then** every
   money value on every surface displays using that currency's symbol/code
   and correct decimal formatting.
2. **Given** the interface language is Arabic, **When** any of those surfaces
   render, **Then** numbers and dates follow Arabic locale formatting
   conventions and layout remains RTL.
3. **Given** the interface language is English, **When** any of those surfaces
   render, **Then** numbers and dates follow English locale formatting
   conventions and layout remains LTR.
4. **Given** a workspace still on the default SAR currency, **When** the same
   surfaces are viewed, **Then** formatting is unchanged from current
   behavior (no regression for the common case).

---

### User Story 4 - RTL/LTR layout correctness is protected as currency and locale storage change (Priority: P3)

As language-preference storage and currency formatting change under the
hood, the existing Arabic RTL and English LTR layout behavior across the core
surfaces continues to work exactly as it does today, with no visual or
directional regression introduced by this phase's changes.

**Why this priority**: RTL/LTR switching already works; this phase's job here
is regression protection, not new capability, so it is valuable but lower
priority than the two genuinely new capabilities above.

**Independent Test**: Re-run the existing Arabic/English + RTL/LTR automated
checks and the manual verification checklist from
`specs/010-testing-security-deployment/manual-ar-en-rtl-checklist.md` after
this phase's changes land, and confirm they still pass with a workspace
currency other than SAR in play.

**Acceptance Scenarios**:

1. **Given** the existing localization/RTL automated test suite, **When** it
   runs after this phase's changes, **Then** it passes without modification to
   its pass/fail expectations beyond adding currency-aware cases.
2. **Given** the manual AR/EN/RTL verification checklist, **When** it is
   re-run against a workspace using a non-SAR currency, **Then** every row
   remains correct with currency values shown in the workspace's currency.

---

### Edge Cases

- **Currency change race**: two concurrent requests attempt to change a
  workspace's currency, or one request changes currency while another creates
  the workspace's first record — the backend MUST make the lock check
  authoritative (re-check "does this workspace have any records yet" inside
  the same transaction/update as the currency change) so at most one of the
  two outcomes wins and no record ever ends up with a currency different from
  the workspace's final configured currency.
- **Existing pre-phase workspaces**: workspaces created before this phase
  ships have no `currency` value stored; they MUST be treated as SAR (the
  existing behavior) with no required backfill migration step beyond adding
  the column with a SAR default.
- **Unsupported currency requested**: a request to set a currency outside the
  supported list MUST be rejected with a clear validation error, not silently
  coerced to SAR or accepted.
- **User with a stored preference that becomes invalid** (e.g. a locale value
  no longer supported): the system MUST fall back to the existing default
  locale behavior rather than erroring.
- **AI extraction review amounts**: extracted draft amounts MUST be presented
  and, once confirmed, stored using the workspace's currency; extraction MUST
  NOT introduce a different currency than the workspace's configured one.
- **Reports and history spanning a currency change**: since currency is
  locked once any record exists, a given workspace's reports and history MUST
  never need to reconcile two currencies — there is exactly one currency for
  the workspace's entire recorded lifetime.
- **Deleted/draft records**: deleted and unconfirmed AI records continue to
  follow existing financial-accuracy rules (excluded from totals); this phase
  only changes what currency they are denominated in, not whether they count.

## Requirements *(mandatory)*

### Functional Requirements

#### Language preference persistence

- **FR-001**: The system MUST store each user's selected interface language
  preference durably against their account, in addition to (or instead of)
  the existing session/cookie mechanism, so the preference is available on
  any device or browser where that user signs in.
- **FR-002**: When a signed-in user has a stored language preference and no
  explicit in-session locale choice is already present, the system MUST use
  the stored preference to choose the starting language in preference to a
  browser/cookie default.
- **FR-003**: Users MUST be able to change their stored language preference
  at any time from Settings (or by explicitly selecting a language via the
  existing language switcher), with the change taking effect immediately in
  the current session, persisting for future sessions, and always winning
  over the stored preference for the session in which it was made.
- **FR-004**: The system MUST continue to support exactly the two interface
  languages already shipped (Arabic and English) with their existing RTL and
  LTR layout behavior; this phase does not add a third language.
- **FR-005**: A user with no stored language preference MUST see the existing
  default-locale behavior, unchanged by this phase.

#### Workspace base currency

- **FR-006**: Every workspace MUST have exactly one base currency at all
  times, defaulting to SAR for newly created workspaces and for workspaces
  that existed before this phase.
- **FR-007**: The system MUST restrict a workspace's base currency to a fixed,
  supported currency list and MUST reject any value outside that list.
- **FR-008**: Only a workspace's Owner MUST be able to change its base
  currency; every other role's attempt MUST be denied by the backend.
- **FR-009**: The system MUST allow a workspace's Owner to change its base
  currency only while the workspace has never had an income or expense
  record — counting every row ever created (including soft-deleted ones) but
  excluding unconfirmed AI-extraction drafts, which are not yet income/expense
  records. Once the workspace has had at least one such record, the currency
  MUST be locked permanently and further change attempts MUST be rejected
  with a clear explanation.
- **FR-010**: New income and expense records MUST be created using the
  workspace's currently configured base currency; the system MUST NOT allow a
  record to be created with a currency different from its workspace's base
  currency.
- **FR-011**: This phase MUST NOT introduce exchange-rate conversion, and
  MUST NOT allow a single workspace to hold income or expense records
  denominated in more than one currency at any point in time.

#### Currency- and locale-aware formatting

- **FR-012**: Money values MUST be formatted for display using the owning
  workspace's base currency (correct symbol/code and decimal precision for
  that currency) everywhere a monetary amount is shown: dashboard, income/
  expense records, reports and summaries, AI extraction review, and history.
- **FR-013**: Numbers and dates MUST be formatted according to the acting
  user's selected interface language/locale, consistently across the same
  surfaces listed in FR-012.
- **FR-014**: Date formatting changes introduced by this phase MUST remain on
  the existing Gregorian calendar; this phase MUST NOT introduce an
  alternate calendar system.
- **FR-015**: Backend API responses that carry a currency code MUST reflect
  the record's/workspace's actual configured currency rather than a fixed
  literal, and backend calculations (totals, balances) MUST remain correct
  and currency-agnostic (they operate on integer minor units regardless of
  which supported currency is configured).

#### Contracts, migration, and non-regression

- **FR-016**: The database schema MUST be updated so that the currency
  constraint on income and expense records is derived from (or validated
  against) the owning workspace's configured currency instead of a fixed
  `SAR`-only constraint.
- **FR-017**: Backend API schemas and frontend API client types that
  currently hard-code a single-currency literal MUST be updated to represent
  the supported currency list instead of a fixed single value.
- **FR-018**: This phase MUST preserve every existing financial-accuracy and
  tenant-isolation guarantee (Principles IX–X of the constitution); currency
  MUST NOT be used to bypass or alter how totals, balances, or workspace
  isolation are computed or enforced.
- **FR-019**: This phase MUST preserve existing Arabic/English and RTL/LTR
  behavior on all core surfaces; the existing automated localization/RTL
  tests and the manual AR/EN/RTL verification checklist MUST continue to
  pass, extended only with currency-aware cases.
- **FR-020**: Tests MUST cover: per-user language-preference persistence and
  precedence over cookie/session defaults; workspace currency selection,
  locking after first record, and Owner-only enforcement; currency- and
  locale-aware formatting on the dashboard, records, reports, AI review, and
  history; and the existing financial-accuracy edge states (now exercised
  under at least one non-SAR workspace currency).

### Key Entities *(include if feature involves data)*

- **User Language Preference**: A durable, per-user record of the selected
  interface language (Arabic or English), associated with the user's account
  rather than a browser session, and used to determine interface language and
  direction on sign-in from any device.
- **Workspace Base Currency**: A single currency code attached to a
  workspace, drawn from the supported currency list, defaulting to SAR,
  changeable only by the Owner and only before the workspace has any income
  or expense record, and thereafter locked for the life of the workspace.
- **Income / Expense Record (extended)**: Existing entities whose currency
  value MUST match their owning workspace's currently configured base
  currency at creation time; no change to their amount, minor-unit, or
  confirmation semantics.
- **Supported Currency List**: A fixed reference list of currency codes
  (headed by SAR) that a workspace's base currency may be set to; adding a
  currency to this list is a data change, not a structural one.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of users who explicitly select a language preference see
  that language applied on their next sign-in from any device or browser,
  with zero reliance on a matching cookie being present.
- **SC-002**: 100% of workspaces have exactly one resolvable base currency at
  all times (existing workspaces read as SAR with no manual migration step
  required).
- **SC-003**: 100% of attempts by a non-Owner to change a workspace's currency
  are denied, and 100% of attempts to change currency on a workspace with at
  least one existing record are denied.
- **SC-004**: In a workspace configured with a non-SAR currency, 100% of
  money values across the dashboard, records, reports, AI review, and history
  surfaces display using that currency, with zero surfaces still showing the
  prior hard-coded SAR-only formatting.
- **SC-005**: The existing Arabic (RTL) / English (LTR) automated test suite
  and manual verification checklist pass at the same rate as before this
  phase (no regression), including when re-run against a non-SAR workspace
  currency.
- **SC-006**: 100% of the existing financial-accuracy edge-state tests
  (zero income, zero expenses, negative remaining balance, edited record,
  deleted record, pending AI draft, failed AI extraction, multiple
  workspaces, viewer restriction) continue to pass unchanged in outcome when
  run against a workspace using a non-SAR supported currency.

## Assumptions

- Arabic/English interface support, RTL/LTR layout switching, and the
  language switcher UI already exist (shipped in earlier phases via
  `next-intl`); this phase adds durable per-user storage of the preference,
  it does not rebuild localization or RTL infrastructure from scratch.
- The supported currency list is a curated, fixed set for this phase — SAR
  (default), USD, EUR, GBP, AED, EGP, KWD, QAR, BHD, OMR — chosen to fit the
  product's Gulf-first, small-team audience; it is ordinary reference data
  and MAY be extended later without a new specification.
- "One base currency per workspace, locked after the first record" is the
  simplest rule consistent with the constitution's explicit exclusion of
  mixed-currency accounting and exchange-rate conversion; it avoids needing
  any conversion or backfill logic.
- Workspace currency changes follow the same Owner-only authorization pattern
  already used for other workspace-level settings (e.g.
  `auto_delete_after_extraction`).
- A user with no stored language preference continues to see whatever
  default-locale behavior the application already has; this phase does not
  change that default, only what happens once a user has explicitly chosen a
  language.
- Money continues to be stored as integer minor units per the constitution's
  Financial Accuracy principle; introducing additional currencies does not
  introduce floating-point arithmetic anywhere in the calculation path.
- This phase's date-formatting changes are limited to locale-appropriate
  presentation (ordering, script, calendar-neutral formatting) of the
  existing Gregorian calendar; Hijri or other calendar systems are out of
  scope.
- This phase supersedes the SAR-only reporting scope boundary recorded in
  `specs/009-reports-summaries-history` (its FR-034); reports become
  currency-aware based on each workspace's single configured currency rather
  than remaining SAR-only, without introducing multi-currency reporting
  across workspaces.
