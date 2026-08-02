# Contract: Rate Limiting and Abuse Protection

**Feature**: `018-security-remediation-hardening` | **Date**: 2026-07-30

Implementation target: `apps/api/app/core/rate_limit.py` (new), applied at four existing routes.

---

## Allowances

Fixed one-hour window, counted per account (spec FR-017, FR-020).

| Bucket | Allowance | Route | File:line |
|---|---|---|---|
| `support_checkout` | **5** / hour | `POST /support-purchases/checkout-sessions` | `routes/support_purchases.py:444` |
| `support_verify` | **10** / hour | `POST /support-purchases/mobile/verify` | `routes/support_purchases.py:520` |
| `ai_extraction` | **30** / hour | `POST /workspaces/{workspace_id}/files/{file_id}/extractions` | `routes/extractions.py:25` |
| `ai_summary` | **10** / hour | `POST /workspaces/{workspace_id}/reports/ai-summary` | `routes/reports.py:52` |

Each ceiling is roughly an order of magnitude above realistic human use, so no genuine user is
affected while abuse stays bounded. Thresholds are configurable via `core/config.py` with these as
defaults; the defaults are the contract.

### Explicitly NOT throttled

| Route | Why |
|---|---|
| `POST /support-purchases/webhooks/stripe` | Spec FR-021. A signature-verified provider delivery is authoritative purchase state. Providers legitimately burst and retry; refusing one silently loses a real payment or refund. |
| `POST /support-purchases/webhooks/apple` | Same |
| `POST /support-purchases/webhooks/google` | Same |
| All read endpoints (`GET`) | No cost, no state change |
| `GET /health` | Must stay trivially available for orchestration probes |

---

## Ordering guarantee — the load-bearing mechanism

Spec FR-018 requires the refusal to happen **before** any purchase record is created or changed,
before any payment session exists, and before any external provider is contacted.

**Mechanism**: apply the limiter as a **route-level decorator dependency**, not as middleware and not
as an in-body check.

```python
@router.post(
    "/checkout-sessions",
    response_model=CheckoutSessionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit_support_checkout)],   # ← resolved FIRST
)
async def create_checkout_session(
    body: CheckoutSessionRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_trusted_session),  # ← opens a transaction
) -> CheckoutSessionResponse:
```

**Why this ordering holds**: FastAPI's `APIRoute` inserts decorator-level `dependencies` at the
**front** of `self.dependant.dependencies`, and `solve_dependencies` walks that list in order. So a
route-level dependency is resolved before the endpoint's own parameter dependencies — including
`get_trusted_session`, which opens a transaction, and before the endpoint body, which calls
`create_stripe_checkout_session` and `create_pending`.

**This must be asserted by test, not assumed** (see `security-regression-tests.md` RL-2/RL-3): a
throttled request must leave zero new `support_purchases` rows and make zero provider calls.

An in-body check would run *after* `get_trusted_session` had already opened a transaction. Middleware
would run before authentication and so could not key on `user_id`.

### Dependency on authentication

The limiter needs the authenticated `user_id` for its key, so it depends on `get_current_user`:

```python
async def rate_limit_support_checkout(
    current_user: CurrentUser = Depends(get_current_user),
) -> None: ...
```

`get_current_user` is cached per request by FastAPI's dependency cache, so declaring it in both the
limiter and the endpoint does **not** double-verify the token or double-run
`_repair_personal_workspace`.

Consequence, and it is the correct precedence: an **unauthenticated** request is rejected `401`
before throttling is considered. Throttling is a per-account control and there is no account yet.

---

## Refusal contract

**HTTP status**: `429 Too Many Requests`

**Body** — matches the existing envelope produced by `main.py:55-69`, so `apiFetch` parses it with no
client change:

```json
{ "error": { "code": "rate_limited", "message": "Too many requests. Try again later." } }
```

**Requirements**:

- `code` MUST be exactly `rate_limited` — stable, machine-readable (spec FR-019).
- The message MUST NOT disclose the configured threshold, the count so far, or the time remaining
  (spec FR-019). A `Retry-After` header is therefore **not** sent.
- The refusal MUST NOT be logged with the request body or any provider identifier.

**Naming collision to avoid**: `apps/web/messages/en.json:455` already contains
`extraction.rate_limited` — "The AI provider is rate-limiting requests." That refers to the *provider*
throttling *us*. The new key is `errors.rateLimited` under the existing `errors` namespace (which
already holds `generic`, `requestFailed`, `unauthenticated`, `notFound`). The two must not be
conflated.

**Localisation** (spec FR-025, SC-019): add `errors.rateLimited` to **both**
`apps/web/messages/en.json` and `apps/web/messages/ar.json`. Constitution Principle IV makes an
untranslated string a visible regression in the Arabic-first interface.

---

## Failure mode: fail closed

Spec FR-024. If the limiter raises unexpectedly, **refuse** the request with the same `429`
contract.

Rationale: a refusal can never alter financial or purchase state, so fail-closed has no correctness
downside. Failing open would silently remove the only abuse control, and the failure would be
invisible. The limiter performs no network or disk access, so its failure probability is very low.

Implementation shape:

```python
try:
    allowed = _consume(key, bucket)
except Exception:            # noqa: BLE001 — deliberate: fail closed
    raise _rate_limited()
if not allowed:
    raise _rate_limited()
```

---

## Counter structure

| Aspect | Value |
|---|---|
| Key | `(str(user_id), bucket_name)` |
| Value | `(window_start_epoch_hour, count)` |
| Window | fixed 1 hour, aligned to a monotonic clock, not wall-clock |
| Storage | module-level dict, one per process |
| Eviction | lazily on access when the window has rolled; a periodic sweep bounds memory |
| Concurrency | guarded so concurrent requests for one key cannot both pass the final slot |

**Use a monotonic clock** for window arithmetic so an NTP correction or DST change cannot widen or
reset a window.

**Bound the dictionary.** An unbounded `dict` keyed by `user_id` is itself a memory-growth vector: an
attacker with many accounts, or simply a large user base, grows it without limit. Evict expired
windows on access and cap total entries, discarding the oldest.

### Accepted limitations — document, do not hide (spec FR-023)

| Limitation | Consequence | Why accepted |
|---|---|---|
| Per-instance counters | Effective allowance = configured value × instance count on Bunny Magic Containers | A shared store (Redis) is a new infrastructure dependency absent from the constitution's Technology Constraints and would need its own spec |
| Reset on restart | A redeploy clears all counters | Throttling is a cost control, not a correctness boundary |
| Fixed window, not sliding | Up to 2× the allowance across a window boundary | Simpler and adequate at these thresholds |

Correctness continues to rest on the unchanged authorization checks and the unchanged purchase state
machine.

These limitations are accepted Phase 18 behavior. Counters are local to one application instance,
so multiple Bunny Magic Containers instances multiply the effective global allowance by the number
of instances. Restarting or replacing an instance clears its counters. Because this is a fixed
window rather than a sliding window, traffic straddling a boundary can consume up to twice the
configured allowance in a short interval. This design is therefore neither globally distributed nor
durable. Strict global enforcement would require a future shared Redis- or database-backed limiter,
which is intentionally outside Phase 18.

---

## Idempotency-key fix (spec FR-022)

Separate from throttling, same abuse surface.

**Current** — `apps/api/app/routes/support_purchases.py:476`:

```python
idempotency_key=f"support-{current_user.user_id}-{uuid4()}"
```

A fresh `uuid4()` per call means the key never matches a previous attempt, so Stripe's idempotency
mechanism provides **no repeat protection**. Every double-submit mints a new Checkout Session and a
new `pending` row.

**Required**: derive the key from stable request characteristics — the user id, the tier id, and a
coarse time bucket — so a repeated identical attempt within that bucket collapses onto the same
Stripe Checkout Session.

**Interaction to preserve**: `create_pending` already treats a replay for the same user as a no-op via
`on conflict (channel, provider_transaction_id) do nothing` plus an owner re-check
(`services/support_purchases.py:120-160`). A stable idempotency key makes Stripe return the *same*
`cs_...` id, which then hits that existing conflict path correctly. Behaviour for a genuinely new
purchase attempt in a later bucket is unchanged.

**Must not break**: a user legitimately buying the same tier twice. The time bucket must be short
enough that a deliberate second purchase succeeds, and long enough that a double-click collapses.
