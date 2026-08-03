# Phase 0 Research: Security Remediation and Production Hardening

**Feature**: `018-security-remediation-hardening` | **Date**: 2026-07-30

Every decision below was verified against the actual repository code at branch
`018-security-remediation-hardening` (forked from `main` @ `2017d24`) before being recorded. File
and line references are exact. Where a claim about PostgreSQL or FastAPI behaviour is load-bearing,
it is marked with how it will be **proven** during implementation rather than assumed.

---

## R-001: How to make a privileged routine unreachable by clients

**Decision**: Create a `private` schema, relocate the four confirmed-vulnerability functions into
it with `ALTER FUNCTION ... SET SCHEMA private`, `GRANT USAGE ON SCHEMA private TO authenticated`,
and **retain** `GRANT EXECUTE` for `authenticated` on each relocated function.

**Rationale**: The exposure comes from PostgREST publishing schemas, not from the privilege model.
`supabase/config.toml:11` sets `schemas = ["public"]`; PostgREST only routes
`/rest/v1/rpc/<name>` for functions in a published schema. A function in `private` has no HTTP
route regardless of its grants.

Retaining `EXECUTE` is not an oversight — it is **required**. The backend calls these functions
from a session that has executed `set local role authenticated` (`apps/api/app/db.py:58`, and
`apps/api/app/core/auth.py:138` for the bootstrap path). If `EXECUTE` were revoked from
`authenticated`, all four backend call sites would fail. The load-bearing control is schema
publication; grants stay as they are.

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| `REVOKE EXECUTE ... FROM authenticated` | Breaks all four backend call sites. For the two deferred RLS helpers it would additionally break every RLS policy in the database — an immediate total outage. Recorded as a prohibition in spec FR-011. |
| Have the backend use the service-role key for these calls | Explicitly forbidden by the feature brief and spec FR-003. It would also discard RLS enforcement on the backend's own queries — a large security regression to fix a smaller one. |
| Drop the functions and inline their SQL into the backend | `ensure_personal_workspace` must stay callable from the `handle_new_user` trigger on `auth.users`; `find_user_profile_by_email` and `get_workspace_ai_key_for_extraction` need `SECURITY DEFINER` to cross RLS and Vault boundaries. Inlining is not possible without granting the backend broader rights. |
| Rewrite the functions to take zero parameters and read `auth.uid()` | Correct for two of them, but `ensure_personal_workspace` runs on the trigger path where `auth.uid()` is NULL (see R-004), and `find_user_profile_by_email` legitimately needs an arbitrary email argument for the invite flow. Applied as *additional* hardening in R-004, not as the primary fix. |
| Set `schemas = []` / remove `public` from publication | Would break the entire web client, which uses `supabase-js` against PostgREST for auth. Not viable. |

---

## R-002: What `ALTER FUNCTION ... SET SCHEMA` does and does not preserve

**Decision**: Rely on OID preservation for **RLS policy expressions**, and explicitly
`CREATE OR REPLACE` every **function body** that references a moved function by name.

**Rationale — the asymmetry is the central technical risk of this phase**:

- **RLS policy expressions are OID-bound.** A policy's `USING`/`WITH CHECK` clause is stored as a
  parsed node tree holding the function's `oid` in `funcid`. `ALTER FUNCTION ... SET SCHEMA`
  updates `pg_proc.pronamespace` and leaves the OID unchanged, so policies continue to resolve and
  simply render as `private.<fn>(...)` afterwards. **No policy rewrite is required.**
- **Function bodies are name-bound.** `LANGUAGE plpgsql` bodies, and `LANGUAGE sql` bodies written
  in the traditional `AS $$ ... $$` form (as opposed to `BEGIN ATOMIC`), are stored as *text* in
  `pg_proc.prosrc` and are parsed at execution time using the function's `search_path`. After a
  move, `public.<fn>` no longer resolves. **The failure appears at runtime, not at migration
  time** — the migration succeeds and the breakage stays invisible until the dependent flow runs.

**This assumption is not taken on faith.** Implementation task set 1 proves both halves on a
disposable database before the real migration is authored (spec FR-015): one test asserts a policy
still enforces correctly after a move, and a complementary test asserts an un-rewritten function
body **fails**. If OID-following does not hold, the documented fallback is to `DROP`/`CREATE` every
affected policy in dependency order — which is exactly the cost this decision avoids, and the
reason the deferred scope in R-003 is deferred.

**Verified reference counts** (exhaustive grep over `supabase/migrations/`):

| Function | Policy refs | Body refs | Backend call sites |
|---|---|---|---|
| `ensure_personal_workspace` | 0 | **1** — `handle_new_user`, `20260624000000_auth_workspace_foundation.sql:283` | `apps/api/app/core/auth.py:144` |
| `get_workspace_ai_key_for_extraction` | 0 | 0 | `apps/api/app/services/extractions.py:245`, `apps/api/app/services/ai_summary.py:63` |
| `find_user_profile_by_email` | 0 | 0 | `apps/api/app/routes/workspace_members.py:142` |
| `shares_workspace_with` | **1** — `20260624000000_auth_workspace_foundation.sql:162` | 0 | none |

All four bodies reference only `public.*` objects that stay in `public`, so each function's existing
`set search_path` value remains correct without modification. `get_workspace_ai_key_for_extraction`
calls `public.workspace_role_for` at line 113 — valid precisely because that helper stays put
(R-003).

---

## R-003: Why `workspace_role_for` and `is_workspace_member` are deferred

**Decision**: Leave both in `public` for the release-blocking work. Track relocation as spec User
Story 7 / FR-034, explicitly outside the release gate, droppable.

**Rationale**: Cost/benefit is inverted compared with the other four.

*Benefit is small.* Both take a workspace UUID as their first argument. Workspace UUIDs are
`gen_random_uuid()` values, are not enumerable through any published function, and
`list_workspaces` (`apps/api/app/routes/workspaces.py:59-89`) returns only the caller's own. An
attacker must already know a workspace id to learn anything, and what they learn is one role
string.

*Cost is large and partly invisible.* Verified counts: ~48 policy references to
`workspace_role_for` and ~7 to `is_workspace_member` (these auto-follow per R-002), **plus five
function-body references that do not**:

| File:line | Containing function | Breaks if unfixed |
|---|---|---|
| `20260624000000_auth_workspace_foundation.sql:70` | `is_workspace_member` (`language sql`) | all membership checks |
| `20260704000000_byok_ai_settings.sql:42` | `set_workspace_ai_key` | AI key configuration |
| `20260704000000_byok_ai_settings.sql:118` | `clear_workspace_ai_key` | AI key removal |
| `20260705000000_ai_extraction_review.sql:113` | `get_workspace_ai_key_for_extraction` | AI key read → all AI features |
| `20260720010000_ai_extraction_confirm_workspace_currency.sql:50` | `confirm_ai_extraction` | AI extraction confirm |

One additional hazard: `20260722000000_hierarchical_categories.sql:239` references
`workspace_role_for(...)` **unqualified**, the only such reference in the codebase. It resolved via
`search_path` when that policy was created, so it is OID-bound and safe — but it demonstrates that
qualification is not uniform, so a name-based audit alone would miss references.

**Alternative considered**: relocate them and accept the body rewrites. Rejected for this phase —
it converts a low-risk, four-function change into one touching AI settings and extraction confirm,
directly against the spec's "no product behaviour changes" property. Revisit as its own phase.

---

## R-004: Making the bootstrap routine identity-safe without breaking signup

**Decision**: Add to `ensure_personal_workspace`:

```sql
if auth.uid() is not null and auth.uid() is distinct from target_user_id then
    raise exception 'identity_mismatch' using errcode = '42501';
end if;
```

**Rationale**: `ensure_personal_workspace` has **two** callers with different identity contexts:

1. `apps/api/app/core/auth.py:144` — inside a transaction that has set
   `role = authenticated` and `request.jwt.claims` (lines 138-146), so `auth.uid()` resolves to the
   caller and always equals `target_user_id`, which is derived from the verified token's `sub`
   (`auth.py:193`).
2. `public.handle_new_user()` — an `AFTER INSERT ON auth.users` trigger
   (`20260624000000_auth_workspace_foundation.sql:276-291`). This fires with **no request context**,
   so `auth.uid()` is **NULL**.

A guard of `auth.uid() = target_user_id` would therefore break every new signup. The
`is not null and is distinct from` shape permits the trigger path, permits the backend's
own-identity path, and refuses impersonation. `is distinct from` (not `<>`) is required so a NULL
`target_user_id` compares safely.

This is defence in depth, not the primary fix. It matters because the primary fix depends on hosted
dashboard configuration outside version control (R-005) — after this change, **two independent
controls** must both fail before the C1 identity rewrite is possible again.

**Alternatives considered**: drop `target_user_id` and use `auth.uid()` only — breaks the trigger
path. Add a boolean `p_trusted` flag — a caller-supplied trust assertion is exactly the
vulnerability class being fixed. Move the guard into the backend only — leaves the database
routine unsafe if reachable, defeating the purpose.

---

## R-005: The hosted exposed-schemas setting is the load-bearing control

**Decision**: Treat "hosted project's exposed schemas excludes `private`" as an explicit,
evidence-recorded release gate (spec FR-038), not an assumption. Additionally add a smoke check
that runs against the **deployed** API.

**Rationale**: `supabase/config.toml:11` governs the **local** Supabase stack only. Hosted Supabase
projects set exposed schemas in Dashboard → Project Settings → API → "Exposed schemas" (default
`public, graphql_public`). That value is not in version control and no test running against a local
stack can observe it. If someone adds `private` there, every relocation in this phase silently
reverts to exploitable with **no code change and no failing test** — the worst possible failure
shape.

Mitigations, in order of strength: (1) R-004's independent identity guard, which survives this
misconfiguration for the Critical finding; (2) the recorded release-gate evidence; (3) a
post-deploy smoke assertion that `POST {DEPLOYED_URL}/rest/v1/rpc/ensure_personal_workspace`
returns 404.

**Alternative considered**: encode the setting as infrastructure-as-code. Rejected for this
phase — the project has no Supabase-management-API automation, and adding one is a larger change
than the fix it guards. Recorded as a future improvement.

---

## R-006: Idempotent, guarded migration form

**Decision**: Wrap each relocation in a `pg_proc`/`pg_namespace` existence guard so the migration
converges from any starting state, and use `create schema if not exists private`.

```sql
do $$
begin
    if exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'ensure_personal_workspace'
    ) then
        alter function public.ensure_personal_workspace(uuid, text) set schema private;
    end if;
end $$;
```

**Rationale**: Two starting states must both converge. A clean `supabase db reset` replays
`20260624000000...` (creating the function in `public`) then this migration (moving it). The
developer's actual local database has diverged from the tracked history — prior phases were applied
via `psql` rather than tracked migration runs — so the function may already be moved or absent. A
bare `ALTER FUNCTION` errors in that case and aborts the whole migration. Guards make the migration
re-runnable, satisfying spec FR-012 and SC-016.

**Ordering** (spec FR-016): schema creation → grants → relocations → dependent-body
`CREATE OR REPLACE` → identity guard. Each step is safe if the migration aborts midway: the schema
and grants are inert on their own, and a relocation without its dependent-body rewrite fails
*closed* (the dependent flow errors) rather than open (no security control is lost).

**Alternative considered**: a reversible down-migration inside `supabase/migrations/`. Rejected —
`supabase db reset` replays that directory in filename order, so a committed reversal would undo
the fix on every environment rebuild. Reversal statements go to
`specs/018-security-remediation-hardening/rollback.sql`, reviewed but never auto-applied (spec
FR-013).

---

## R-007: Rate-limiting mechanism

**Decision**: A hand-written in-process fixed-window counter, ~50 lines in a new
`apps/api/app/core/rate_limit.py`, exposed as a FastAPI **route-level dependency**. No new
package, no new infrastructure.

**Rationale**:

- *Why route-level `dependencies=[...]` and not middleware or in-body checks.* FastAPI's
  `APIRoute` inserts decorator-level `dependencies` at the **front** of the dependant list, and
  `solve_dependencies` walks that list in order — so a route-level dependency is resolved **before**
  the endpoint's own parameter dependencies, including `get_trusted_session`. This is what
  mechanically satisfies spec FR-018: the refusal happens before any transaction opens, before
  `create_pending`, and before any Stripe/Apple/Google call. An in-body check would run after the
  session dependency has already opened a transaction. *To be confirmed by test, not assumed —* a
  task asserts no purchase row and no provider call for a throttled request.
- *Why not `slowapi`.* It adds a dependency plus its `limits` transitive for behaviour this needs
  ~50 lines to express, and its default key function is client-IP based, which is wrong here — spec
  FR-020 requires per-account scoping, and IP-based limiting would let one NAT'd office throttle
  itself.
- *Why in-process.* Clarification decision: a shared store (Redis) is a new infrastructure
  dependency absent from the constitution's Technology Constraints, requiring its own spec. Accepted
  consequences, to be documented not hidden (spec FR-023): effective allowance multiplies by
  instance count on Bunny Magic Containers, and counters reset on restart.
- *Why fail closed.* Clarification decision. A refusal cannot alter financial or purchase state, so
  fail-closed has no correctness downside; fail-open would silently remove the only control.
- *Why webhooks are exempt.* Spec FR-021. Providers legitimately burst and retry; throttling a
  signature-verified delivery would lose a real payment or refund. Webhook routes get no limiter.

**Allowances** (spec FR-017, fixed 1-hour window, per `user_id`): checkout 5, mobile verify 10,
extraction trigger 30, AI summary 10.

**Idempotency fix** (spec FR-022): `apps/api/app/routes/support_purchases.py:476` currently builds
`f"support-{user_id}-{uuid4()}"`. A fresh UUID per call means the Stripe idempotency key never
matches a previous attempt, so it provides no repeat protection. Replace the random component with
a stable derivation over `(user_id, tier_id, coarse time bucket)` so a double-submit collapses onto
one Checkout Session.

---

## R-008: Making log redaction effective

**Decision**: Attach `SensitiveDataFilter` to logging **handlers**, and ensure at least one handler
exists.

**Rationale**: `apps/api/app/core/logging.py:28-33` attaches the filter to *loggers* (`""`,
`uvicorn`, `uvicorn.access`, `uvicorn.error`, `fastapi`). Python applies a logger's filters only
inside `Logger.handle()`, which runs on the logger where the record **originated**;
`callHandlers()` then walks ancestor loggers invoking their **handlers**, applying each handler's
filters but **not** ancestor loggers' filters. A record from `app.services.storage` therefore never
passes the root logger's filter. Handler-level attachment is the level that sees every propagated
record.

Not currently leaking: every existing log site self-redacts first — `_sanitized_db_error`
(`apps/api/app/core/auth.py:40-47`), `_redact_secret` / `_sanitized_response_body`
(`apps/api/app/services/storage.py:59-71`), and the webhook logs which carry only event and
notification ids. This fixes the safety net for the next log statement anyone writes, and spec
SC-012 requires proving it with a module-level logger.

**Alternative considered**: a `logging.LoggerAdapter` or structured-logging library. Rejected as
disproportionate; the existing filter is correct in substance and only mis-attached.

---

## R-009: Pinning the accepted token signing algorithm

**Decision**: Derive accepted algorithms from trusted material, never from the token header. For the
HS256 path, gate on `settings.supabase_jwt_secret` being present and pass
`algorithms=["HS256"]`. For the JWKS path, take the algorithm from the **resolved JWK's** own `alg`
(falling back to a fixed allow-list of `["ES256", "RS256"]` derived from key type), never from
`header["alg"]`. Add `TypeError` to the caught exception tuple.

**Rationale**: `apps/api/app/core/auth.py:105-121` reads `alg` from the unverified header and
passes it straight to `jwt.decode(algorithms=[algorithm])`. Traced to the end, this is **not** an
authentication bypass: with `alg: HS256` and no `supabase_jwt_secret` configured, control reaches
the JWKS branch, and PyJWT's `HMACAlgorithm.prepare_key` calls `force_bytes` on a `cryptography`
public-key object, raising `TypeError`. That is **not** in the caught tuple at line 122
(`httpx.HTTPError`, `jwt.PyJWTError`, `ValueError`), so it escapes as an unhandled 500 to an
unauthenticated caller. The fix removes both the 500 and the header-controlled algorithm selection.

Positive finding to preserve: Supabase's legacy `anon` and `service_role` keys are HS256 JWTs signed
with the same project secret and *would* pass signature verification, but carry no `sub` and no
`email`, so `auth.py:125-126` and `197-199` reject them. Regression tests must keep asserting this
(spec User Story 5 scenario 5).

---

## R-010: Production surface reduction

**Decision**: Introduce a single `APP_ENV`-derived environment predicate in
`apps/api/app/core/config.py`, used by three call sites.

| Concern | Change | File |
|---|---|---|
| Docs surface | Pass `docs_url=None, redoc_url=None, openapi_url=None` unless dev/test | `apps/api/app/main.py:28` |
| Diagnostics | Replace `_is_test_or_dev_mode()` with the shared predicate | `apps/api/app/core/auth.py:30-37` |
| Health probe | Drop the outbound `urlopen`; make the route `async def` | `apps/api/app/routes/health.py:16-31` |

**Rationale**: `_is_test_or_dev_mode()` already **fails closed** — it returns `False` when
`APP_ENV` is unset, so diagnostics are off by default in production today. That is correct and must
be preserved (spec FR-031); the change is to make the environment decision explicit and shared
rather than re-derived, so the docs gate and the diagnostics gate cannot drift apart.

`/health` currently performs a blocking `urlopen(..., timeout=3)` against Supabase using the
**service-role key**, inside a **sync** `def` route — so every unauthenticated probe occupies an
AnyIO worker thread for up to 3 seconds and spends a privileged credential. The replacement
reports process liveness only. A separate task must first confirm no existing test asserts on the
current `dependencies.database` shape or on `/openapi.json`, since removing them must not silently
break a test (spec Edge Cases).

---

## R-011: Localising the throttling refusal

**Decision**: Backend returns `{"error": {"code": "rate_limited", ...}}` with HTTP 429; the web
client maps the code to a new `errors.rateLimited` message in both `apps/web/messages/en.json` and
`apps/web/messages/ar.json`.

**Rationale**: This matches the existing contract exactly — `apiFetch` already parses
`body.error.code` into `ApiError.code` (`apps/web/lib/api/client.ts`), and the `errors` namespace
already holds `generic`, `requestFailed`, `unauthenticated`, `notFound`. Constitution Principle IV
(Arabic-first) makes an untranslated string a visible regression. Per spec FR-019 the message must
not disclose the threshold or remaining window.

Note the existing unrelated `extraction.rate_limited` key (`en.json:455`) refers to the *AI
provider* rate-limiting us; the new key is distinct and must not be conflated.

---

## R-012: Tightening two default-`PUBLIC` helper grants

**Decision**: Add explicit `revoke all ... from public, anon` plus a narrow grant for
`public.receipt_object_workspace_id(text)` and `public.validate_category_assignment(uuid, uuid, text)`.
Lowest priority, spec FR-035.

**Rationale**: PostgreSQL grants `EXECUTE` to `PUBLIC` by default. An audit of all 27 `public`
functions found every un-revoked one is `returns trigger` — not invocable through PostgREST —
**except** these two. Neither discloses anything: the first is pure string parsing with no table
access; the second is `SECURITY INVOKER`, so RLS applies to its `select` and a non-member gets
`category_not_in_workspace` either way. `receipt_object_workspace_id` is used inside
`storage.objects` policies (`20260702000000_receipt_invoice_storage.sql:146,156,166,171,181`), so
`authenticated` must retain `EXECUTE` — same constraint as R-001.

---

## R-013: Three published routines deliberately left in place

**Decision**: `set_workspace_ai_key`, `clear_workspace_ai_key`, and `confirm_ai_extraction` stay in
`public` unchanged. Recorded so their absence reads as a decision, not an oversight.

**Rationale**: All three derive the acting identity from `auth.uid()` and enforce their own role
checks — Owner-only at `20260704000000_byok_ai_settings.sql:42` and `:118`, and role-plus-ownership
at `20260720010000_ai_extraction_confirm_workspace_currency.sql:50-62`. Direct invocation bypasses
some backend input shaping (`validate_key_shape` at `apps/api/app/services/ai_settings.py:98-113`;
the storage-cleanup orchestration that consumes `confirm_ai_extraction`'s `should_delete_binary`
return) but grants **no privilege the caller does not already hold** through the normal API. The
worst outcome is a self-inflicted malformed key or an orphaned storage object in the caller's own
workspace.

**Residual risk accepted and recorded**: a client calling `confirm_ai_extraction` directly can mark
a file deleted in the database while leaving its bytes in Storage. This is a data-hygiene issue in
the caller's own workspace, not a cross-tenant or privilege issue. Candidate for a future phase.

---

## Resolved unknowns

| Unknown | Resolution |
|---|---|
| Throttling allowances and window | Spec clarification: 5/10/30/10 per hour per account |
| Throttling counter scope | In-process per instance (R-007); multiplication documented |
| Throttling failure mode | Fail closed (R-007) |
| Throttling message localisation | `errors.rateLimited` in en + ar (R-011) |
| Reversal artifact location | `specs/018-.../rollback.sql`, never in `supabase/migrations/` (R-006) |
| Whether policies survive relocation | OID-bound, yes — but **proven by task, not assumed** (R-002) |
| Whether function bodies survive relocation | No — name-bound, must be re-created (R-002) |
| Rate-limit library choice | None; hand-written (R-007) |

**No NEEDS CLARIFICATION items remain.**
