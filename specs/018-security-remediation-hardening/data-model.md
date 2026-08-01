# Phase 1 Data Model: Security Remediation and Production Hardening

**Feature**: `018-security-remediation-hardening` | **Date**: 2026-07-30

## No business data model change

This phase adds **no table, no column, no index, no constraint, and no trigger**. It does not read
or write any business record. The "data model" here is the *namespace and privilege model* of
database routines, plus one in-memory runtime structure.

Stated explicitly because it is a release gate: the migration for this phase must contain **zero**
`create table`, `alter table`, `create policy`, and `drop policy` statements. A reviewer can verify
the tenant-isolation guarantee (spec FR-010, SC-006) by grepping for those four strings and finding
none.

---

## 1. Namespace model

### Before

```text
public   ──  published by PostgREST  (supabase/config.toml:11 → schemas = ["public"])
             ├── 27 functions, of which 9 are granted EXECUTE to `authenticated`
             └── every one of those 9 is reachable at POST /rest/v1/rpc/<name>
```

### After

```text
public   ──  published by PostgREST
             ├── workspace_role_for(uuid,uuid)          [DEFERRED — stays, see R-003]
             ├── is_workspace_member(uuid,uuid)         [DEFERRED — stays, see R-003]
             ├── set_workspace_ai_key(uuid,text,text)   [SAFE — stays, see R-013]
             ├── clear_workspace_ai_key(uuid)           [SAFE — stays, see R-013]
             ├── confirm_ai_extraction(...)             [SAFE — stays, see R-013]
             ├── handle_new_user()                      [trigger — re-created, now calls private.*]
             └── 18 other trigger-only functions        [not RPC-invocable]

private  ──  NOT published by PostgREST  ← the load-bearing control
             ├── ensure_personal_workspace(uuid,text)             [C1]
             ├── get_workspace_ai_key_for_extraction(uuid)        [H1]
             ├── find_user_profile_by_email(text)                 [M1]
             └── shares_workspace_with(uuid,uuid)                 [M2]
```

### Relocation inventory

Reference counts are from an exhaustive grep of `supabase/migrations/` and `apps/api/`.

| Routine | Finding | Policy refs (OID-bound, auto-follow) | Body refs (name-bound, must re-create) | Backend call sites |
|---|---|---|---|---|
| `ensure_personal_workspace(uuid,text)` | C1 Critical | 0 | **1** — `handle_new_user` @ `20260624000000...:283` | `core/auth.py:144` |
| `get_workspace_ai_key_for_extraction(uuid)` | H1 High | 0 | 0 | `services/extractions.py:245`, `services/ai_summary.py:63` |
| `find_user_profile_by_email(text)` | M1 Medium | 0 | 0 | `routes/workspace_members.py:142` |
| `shares_workspace_with(uuid,uuid)` | M2 Medium | **1** — `20260624000000...:162` | 0 | none |

**Total work implied**: 4 relocations, 1 dependent-body re-creation, 4 call-site re-qualifications,
**0 policy rewrites**.

### Deferred inventory (NOT touched this phase)

Recorded so User Story 7 can be executed later without re-deriving it, and so `/speckit-analyze`
reads the omission as intentional.

`workspace_role_for(uuid,uuid)` — ~48 policy references across:
`20260624000000...` 187, 188, 202, 210, 212, 217, 219, 230, 232 ·
`20260625000000...` 161, 167, 168, 182, 189, 190, 204, 212, 214, 219, 221 ·
`20260702000000...` 87, 95, 97, 102, 104, 156, 166, 171, 181 ·
`20260703000000...` 23, 26 · `20260704000000...` 19 · `20260705000000...` 43, 53, 76, 77, 80, 81 ·
`20260708000000...` 282 · `20260722000000...` **239 (unqualified — the only such reference)**.

`is_workspace_member(uuid,uuid)` — ~7 policy references:
`20260624000000...` 175, 194 · `20260625000000...` 155, 174, 196 · `20260702000000...` 79, 146.

**Body references that would break silently at runtime** if either helper moved without a
`CREATE OR REPLACE`:

| File:line | Containing routine | Product impact if missed |
|---|---|---|
| `20260624000000_auth_workspace_foundation.sql:70` | `is_workspace_member` | all membership checks |
| `20260704000000_byok_ai_settings.sql:42` | `set_workspace_ai_key` | AI key configuration |
| `20260704000000_byok_ai_settings.sql:118` | `clear_workspace_ai_key` | AI key removal |
| `20260705000000_ai_extraction_review.sql:113` | `get_workspace_ai_key_for_extraction` | all AI features |
| `20260720010000_ai_extraction_confirm_workspace_currency.sql:50` | `confirm_ai_extraction` | AI extraction confirm |

---

## 2. Privilege model

### Invariants that MUST hold after the change

| Grantee | Object | Privilege | Why it must stay |
|---|---|---|---|
| `authenticated` | schema `private` | `USAGE` | The backend executes as `authenticated` (`db.py:58`, `core/auth.py:138`). Without `USAGE` all four call sites fail. |
| `authenticated` | each relocated function | `EXECUTE` | Same reason. Client unreachability comes from schema publication, **not** from this grant. |
| `authenticated` | `public.workspace_role_for`, `public.is_workspace_member` | `EXECUTE` — **MUST NOT be revoked** | Every RLS policy calls them **as the requesting user**. Revoking disables tenant isolation on every table → total outage. Spec FR-011. |
| `public`, `anon` | each relocated function | none | Revoked, matching the current posture in `20260624000000...:43,60,73,93,141`. |

### The counter-intuitive part, stated plainly

After this phase, `authenticated` **still holds `EXECUTE`** on all four relocated functions. They are
not protected by privileges. They are protected by living in a schema that PostgREST does not route
to. That is why:

- spec User Story 2 adds an **independent** identity guard inside `ensure_personal_workspace`, and
- spec FR-038 makes the hosted exposed-schemas setting a release gate with recorded evidence.

If someone adds `private` to a hosted project's exposed-schema list, all four findings become
exploitable again with **no code change and no failing test** — except C1, which the identity guard
still blocks. That asymmetry is the whole justification for User Story 2.

### Default-`PUBLIC` cleanup (P3, spec FR-035)

PostgreSQL grants `EXECUTE` to `PUBLIC` by default. Of the 27 `public` functions, every un-revoked
one is `returns trigger` (not RPC-invocable) except two:

| Function | Current | Disclosure today | Constraint on the fix |
|---|---|---|---|
| `receipt_object_workspace_id(text)` | `PUBLIC EXECUTE`, `SECURITY INVOKER` | None — pure string parsing, no table access | `authenticated` must **retain** `EXECUTE`: used inside `storage.objects` policies at `20260702000000...:146,156,166,171,181` |
| `validate_category_assignment(uuid,uuid,text)` | `PUBLIC EXECUTE`, `SECURITY INVOKER` | None — RLS applies to its `select`; a non-member gets `category_not_in_workspace` either way | Called from `validate_expense_category` / `validate_income_category` trigger bodies |

---

## 3. Routine behaviour change: the identity guard

The only routine whose **logic** changes.

`private.ensure_personal_workspace(target_user_id uuid, target_email text)`

| Caller | `auth.uid()` | `target_user_id` | Guard outcome |
|---|---|---|---|
| `core/auth.py:144` (backend, own identity) | caller's id | same (from verified token `sub`, `auth.py:193`) | **allowed** |
| `public.handle_new_user()` trigger on `auth.users` | **NULL** — no request context | new user's id | **allowed** (NULL-tolerant) |
| A client that reached it despite relocation, targeting someone else | attacker's id | victim's id | **refused**, `42501 identity_mismatch` |
| A client targeting themselves | own id | own id | allowed — harmless, idempotent |

Guard shape (`is distinct from`, not `<>`, so a NULL `target_user_id` compares safely):

```sql
if auth.uid() is not null and auth.uid() is distinct from target_user_id then
    raise exception 'identity_mismatch' using errcode = '42501';
end if;
```

**Unchanged**: the upsert into `public.user_profiles`, the personal-workspace lookup/creation, and
the owner-membership repair. Only the precondition is added.

**Interaction to test around**: `_repair_personal_workspace` (`core/auth.py:130-152`) catches
`DBAPIError` and returns early when `_personal_workspace_exists` is true — so a `42501` raised here
would be **swallowed**. Acceptable (the backend only ever passes the caller's own id, so the guard
can only fire on a genuine bug), but the guard test must invoke the routine directly rather than via
an endpoint, or it will pass without exercising anything.

---

## 4. Runtime structure: throttling counters

The only new stateful structure. **In process memory, never persisted** (spec FR-023).

| Aspect | Value |
|---|---|
| Key | `(user_id, bucket_name)` — per account, so one account cannot deny another (FR-020) |
| Value | count within the current window + window start timestamp |
| Window | fixed 1 hour |
| Scope | one service instance |
| Durability | none — resets on restart |
| Location | `apps/api/app/core/rate_limit.py` |

| Bucket | Allowance/hour | Protected route |
|---|---|---|
| `support_checkout` | 5 | `POST /support-purchases/checkout-sessions` (`routes/support_purchases.py:444`) |
| `support_verify` | 10 | `POST /support-purchases/mobile/verify` (`:520`) |
| `ai_extraction` | 30 | `POST /workspaces/{id}/files/{file_id}/extractions` (`routes/extractions.py:25`) |
| `ai_summary` | 10 | `POST /workspaces/{id}/reports/ai-summary` (`routes/reports.py:52`) |

**Not throttled** (spec FR-021): `POST /support-purchases/webhooks/{stripe,apple,google}`. A
signature-verified provider delivery is authoritative purchase state; refusing one would silently
lose a real payment or refund.

**Accepted limitations, documented not hidden**: the effective allowance multiplies by instance count
on Bunny Magic Containers, and a restart clears all counters. Both are acceptable because throttling
is a cost control, not a correctness boundary — correctness rests on the unchanged authorization
checks and purchase state machine.

---

## 5. Environment identity

Not persisted data, but a configuration entity two controls now share, so they cannot drift.

| `APP_ENV` value | Docs surface (FR-030) | Diagnostic detail (FR-031) |
|---|---|---|
| `test`, `dev`, `development`, `local` | available | included |
| `production` or any other value | unavailable | withheld |
| **unset** | **unavailable** | **withheld** |

The unset row is the important one: the current `_is_test_or_dev_mode()` (`core/auth.py:30-37`)
already returns `False` when `APP_ENV` is absent, so diagnostics are **already off by default** in
production. That fail-closed behaviour is correct and must be preserved, not redesigned. The change
centralises the predicate in `core/config.py` so the docs gate and the diagnostics gate read the same
value.
