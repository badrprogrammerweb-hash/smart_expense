# Contract: Authenticated Session Validation

Shared behavior for every protected endpoint introduced in this phase
(`contracts/workspaces-api.md`, `contracts/workspace-members-api.md`).
Resolves FR-001, FR-023, FR-024, FR-025.

## Request

Every protected endpoint requires:

```
Authorization: Bearer <supabase-access-token>
```

No other authentication method (cookie session, API key, social/SSO token)
is accepted in this phase (FR-002).

## Validation steps

1. FastAPI verifies the token's signature against the Supabase project's
   JWKS and checks `exp`/`nbf` (Research Decision 5). A missing, malformed,
   expired, or signature-invalid token is rejected before any database
   call is made.
2. The verified `sub` claim is treated as the caller's `user_id`. FastAPI
   opens a database transaction and sets the session's `request.jwt.claims`
   and `role` from the verified token (Research Decision 4) so Row Level
   Security evaluates identically to a native Supabase client request.
3. Route handlers never accept a caller-supplied user id for "who am I"
   purposes — it always comes from the verified token.

## Responses

| Condition | Status | Body |
|---|---|---|
| Missing/malformed/expired/invalid-signature token | `401 Unauthorized` | `{"error": {"code": "unauthenticated", "message": "Sign in to continue."}}` |
| Valid token, but the request targets a workspace the caller is not a member of | `404 Not Found` | `{"error": {"code": "not_found", "message": "Workspace not found."}}` |
| Valid token, caller is a member, but lacks the role required for the action | `403 Forbidden` | `{"error": {"code": "forbidden", "message": "You do not have permission to do that."}}` |

A non-member request to a real workspace returns the **same** `404` shape
as a request to a workspace id that does not exist at all — this is
deliberate (FR-024): a `403` would itself confirm the workspace exists.
`403` is reserved for callers who *are* members but lack sufficient role
for the specific action (e.g., a Member calling an Admin-only endpoint),
where membership itself is already not a secret to that caller.

No response body in this phase ever includes a stack trace, raw database
error, or another user's private profile data beyond `email` and `role`
inside a workspace they share with the caller (constitution Principle VI).

The same applies to application logs: request and exception logging MUST
NOT record the raw `Authorization` header, JWT contents, or unredacted
email addresses (constitution Principle VI; `T012a`).

## Acceptance checks

1. A request with no `Authorization` header receives `401` from every
   protected route, with zero database queries executed.
2. A request with a syntactically valid but expired token receives `401`.
3. A request from a real, currently-authenticated user targeting a
   workspace they are not a member of receives `404`, identical in shape
   to a request against a random non-existent workspace id.

## Out of scope for this phase

No refresh-token handling, no session revocation endpoint, and no rate
limiting are implemented here — Supabase Auth issues and refreses tokens on
the client side (Phase 5 builds the UI that calls it); FastAPI only verifies
tokens it is handed.
