# Contract: Backend Health/Status Endpoint

Resolves spec FR-016 and FR-017. This is the only external interface
introduced in Phase 1.

## Request

```
GET /health
```

No authentication, no parameters, no request body. Must be reachable without
any external service configured (FR-017).

## Response

**Status**: Always `200 OK` when the backend process is running — this
endpoint reports configuration state, it does not fail when a dependency is
unconfigured (see Research §4 for rationale).

**Body**:

```json
{
  "status": "ok",
  "dependencies": {
    "database": "not_configured"
  }
}
```

| Field | Type | Values | Meaning |
|---|---|---|---|
| `status` | string | `"ok"` | The backend process started and can respond. This phase has no condition under which a reachable process reports anything other than `"ok"` at the top level. |
| `dependencies.database` | string | `"ok"` \| `"not_configured"` \| `"error"` | `"not_configured"` when the database connection values are not present in the environment (expected default in Phase 1, per FR-017). `"ok"` if connection values are present and a basic connectivity check succeeds. `"error"` if connection values are present but the check fails. |

### Database connection values

The project's eventual database is Supabase (constitution §Technology
Constraints), so the connection values this endpoint checks for are
Supabase-shaped, not a generic SQL `DATABASE_URL`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

`dependencies.database` is `"not_configured"` unless **both** are present;
`"ok"` if both are present and a basic connectivity check succeeds; `"error"`
if both are present but the check fails.

## Acceptance checks (validated via `quickstart.md`)

1. With zero environment variables configured, `GET /health` returns `200`
   with `dependencies.database` = `"not_configured"`. The process must not
   crash or hang waiting on a connection.
2. The response must not include any credential value, connection string, or
   internal stack trace (constitution §VI Privacy and Security).

## Out of scope for this phase

No other endpoint exists yet. Authentication, workspace, income, expense,
and every other domain endpoint listed in the master implementation plan's
API Plan begin in their respective phases (Phase 2 onward).
