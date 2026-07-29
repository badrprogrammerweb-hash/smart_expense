# Phase 1 Data Model: Optional Product Support Purchases

Derived from spec Key Entities + Functional Requirements and the Phase 0
decisions. One new, **account-scoped** table. No change to any existing
table, column, RLS policy, or financial calculation.

## New table: `public.support_purchases`

One row per attempted or completed one-time support purchase. Owned by the
purchasing user's account; **never** by a workspace.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | **PK**, `default gen_random_uuid()` | Purchase record identifier. |
| `user_id` | `uuid` | `not null`, `references public.user_profiles(id) on delete cascade` | The purchasing account. **No `workspace_id` column exists on this table by design** (FR-008; `contracts/isolation-and-scope.md`). |
| `tier_id` | `text` | `not null` | Stable internal tier identifier (e.g. `support_small`/`support_medium`/`support_large`) resolved server-side from the backend tier configuration (research.md R-004). Not a free-form/custom amount (FR-006). |
| `channel` | `text` | `not null`, `check (channel in ('web','ios','android'))` | Which billing system produced this purchase (FR-013, FR-021). |
| `provider_transaction_id` | `text` | `not null` | Stripe Checkout Session/PaymentIntent id (web), Apple original transaction id (iOS), or Google purchase token (Android). |
| `amount_minor_units` | `bigint` | `not null`, `check (amount_minor_units > 0)` | The amount actually charged, exactly as reported by the provider/store — never computed or converted by Smart Expense (FR-006a). Integer minor units, consistent with the project's money-handling rule. |
| `currency` | `text` | `not null` | Currency exactly as reported by the provider/store (FR-006a) — the platform's localized store currency (Apple/Google) or the configured web reference currency (Stripe). |
| `status` | `text` | `not null`, `check (status in ('pending','completed','failed','refunded'))`, `default 'pending'` | Server-authoritative state (FR-015). |
| `failure_reason` | `text` | nullable | Safe, non-technical explanation shown to the user for `failed` (FR-015); never a raw provider error/stack trace. |
| `created_at` | `timestamptz` | `not null default now()` | When the purchase attempt started (e.g., Checkout Session created / native purchase initiated). |
| `updated_at` | `timestamptz` | `not null default now()` | Last state-transition time; set on every status change. |

**Notes**

- **No `workspace_id` column and no foreign key to `public.workspaces`** —
  this is the structural guarantee behind FR-004 and FR-008: it is
  impossible for a dashboard/report/history query scoped to a workspace to
  join this table by accident, because there is no join key.
- No soft-delete column: a purchase's history is retained indefinitely as a
  simple transaction record (mirrors standard billing-record retention); a
  `refunded` row is never deleted, only its `status` changes (FR-019).
- `amount_minor_units` + `currency` together avoid floating-point money
  handling, consistent with the project-wide money rule (Constitution X /
  implementation-plan §8).

### Uniqueness and idempotency

| Constraint | Purpose |
|---|---|
| `unique (channel, provider_transaction_id)` | Guarantees a replayed or duplicate provider/store notification for the same underlying transaction cannot create a second row (FR-018; research.md R-003). |

### State model

```
PENDING (row created on checkout-session start / native purchase start)
   │  verified provider/store "paid" signal (webhook / server-verified receipt)
   ▼
COMPLETED (status = 'completed')
   │  verified provider/store refund signal (webhook / notification)
   ▼
REFUNDED (status = 'refunded')

PENDING
   │  verified provider/store "failed/canceled" signal, or session/purchase
   │  abandoned without a paid signal
   ▼
FAILED (status = 'failed', failure_reason set)
```

Rules:

- A transition to `completed` or `refunded` **MUST** originate from a
  signature-/JWS-/token-verified provider or store signal — never from a
  client-reported redirect parameter or bare OS purchase acknowledgement
  (FR-016; `contracts/webhooks-and-idempotency.md`).
- `refunded` is reachable **only** from `completed` (a purchase must have
  actually completed before it can be refunded).
- No transition ever writes to, or is triggered by, any row in `incomes`,
  `expenses`, `categories`, or any report/dashboard-affecting table (FR-004,
  FR-026).
- A `refunded` row's historical `amount_minor_units`/`currency`/`tier_id`
  are never rewritten — only `status` and `updated_at` change, preserving
  the original receipt's content (spec Edge Cases: "changing a tier's price
  ... must not retroactively change ... an already-issued historical
  receipt").

## Row-Level Security (`support_purchases`)

RLS **enabled**.

| Operation | Policy | Rationale |
|-----------|--------|-----------|
| `SELECT` | `to authenticated using (user_id = auth.uid())` | A user reads only their own purchases, across all channels (FR-021, FR-024); never another user's, never derivable from workspace membership. |
| `INSERT` / `UPDATE` | **No policy for `authenticated`** (deny by default) | All writes happen through backend-service code running with the service role after independently verifying the provider/store signal (checkout-session creation is also service-initiated); no client, including the authenticated web/mobile app, writes this table directly. This mirrors the "writes only through a trusted server path" posture used for `workspace_ai_settings` (Phase 7), adapted here to a service-role-only backend service rather than `SECURITY DEFINER` RPCs, since no end-user role (not even Owner) should be able to mark their own purchase `completed`. |
| `DELETE` | **No policy** (deny by default) | Purchase records are retained as transaction history; nothing in the spec calls for user- or app-initiated deletion. |

## Backend tier configuration (not a database table)

Per research.md R-004, the three preset tiers are backend static
configuration (id, display label, per-channel provider/store product-price
id), served read-only via `GET /support-purchases/tiers`. This is
documented in `contracts/support-purchases-api.md`, not as a data-model
table, since it has no user-editable state in this phase.

## Relationship to existing entities

- **User Profile (existing)** 1—0..N **support_purchases**, via `user_id`.
  Deleting a user profile cascades their purchase rows (consistent with the
  account being gone entirely); this has no effect on any workspace, since
  none existed.
- **Workspace / Workspace Membership (existing)** — **no relationship of any
  kind**. This absence is the load-bearing design decision of this phase
  (`contracts/isolation-and-scope.md`).
- **Income / Expense / Category / Report / History (existing)** —
  **unchanged**. No FK, no shared query path, no trigger; a support purchase
  never appears in, or affects, any of these (FR-004, FR-026; SC-001).
