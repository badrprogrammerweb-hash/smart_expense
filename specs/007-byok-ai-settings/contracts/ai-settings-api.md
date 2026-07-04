# Contract: AI Settings API (FastAPI)

Base path: `/workspaces/{workspace_id}/ai-settings` (new `ai_settings` router,
mounted alongside the existing `workspaces` router). All endpoints require a valid
Supabase JWT (`Authorization: Bearer <token>`) and run over the authenticated RLS
session (`get_rls_session`), exactly like `routes/workspaces.py`.

**The raw API key never appears in any response body, header, or error on any of
these endpoints** (FR-007, FR-009; SC-002).

## Error envelope (shared)

Errors use the app-wide envelope produced by the global exception handlers in
`app/main.py`: `HTTP <status>` with body
`{ "error": { "code": "<code>", "message": "<human message>" } }`. (Route/service
code raises `HTTPException(detail={"code", "message"})`; the handler rewrites
`detail` → `error`. Pydantic request-validation failures are also emitted in this
same `{ "error": { … } }` shape.)

| Status | `code` | When |
|--------|--------|------|
| 401 | `unauthenticated` | Missing/invalid token (handled by `get_current_user`). |
| 404 | `not_found` | Workspace does not exist **or** caller is not a member (existence is not leaked — mirrors `routes/workspaces.py`). |
| 403 | `forbidden` | Caller is a member but **not the Owner** (PUT/DELETE only). |
| 422 | `invalid_request` / `invalid_key_format` | Body invalid (see PUT): `invalid_request` for missing/unsupported provider or missing `api_key` (Pydantic), `invalid_key_format` for a failed shape check. Nothing is stored. |
| 503 | `database_unavailable` | DB/RPC unreachable (existing `database_unavailable_exception`). |

## Model: `AiSettingsStatus` (response for all three endpoints)

```jsonc
{
  "configured": true,                       // boolean; false ⇒ other fields null
  "provider": "openai",                     // "gemini" | "openai" | null
  "masked_hint": "…aB3d",                   // string | null; at most the last 4 chars of the key, never more
  "updated_at": "2026-07-04T10:15:30Z",     // ISO 8601 | null
  "updated_by": "0f2c…",                    // uuid of the user who last set it | null
  "updated_by_name": "Sara"                 // optional display name | null (join to user_profiles)
}
```

When `configured` is `false`, `provider`, `masked_hint`, `updated_at`,
`updated_by`, and `updated_by_name` are all `null`.

## GET `/workspaces/{workspace_id}/ai-settings`

Read the workspace's AI settings **status**. Authorized to **all members**
(Owner, Admin, Member, Viewer) — FR-021.

- **200** → `AiSettingsStatus`. Reads only non-secret metadata columns; never
  touches Vault (Decision 6).
- **404** `not_found` if the caller is not a member of / the workspace does not
  exist.
- Never returns the key (there is no field for it).

## PUT `/workspaces/{workspace_id}/ai-settings`

Configure a new key **or** replace/rotate/switch an existing one (single
idempotent upsert path — Decision 8). **Owner only** — FR-020.

**Request body**
```jsonc
{
  "provider": "openai",        // required; "gemini" | "openai"
  "api_key": "sk-…"            // required; non-empty; validated shape-only (SecretStr, never logged)
}
```

**Behavior**
1. Resolve caller role for the workspace. Not a member → **404**. Member but not
   Owner → **403**.
2. Validate `provider ∈ {gemini, openai}` and `api_key` against the
   provider-appropriate **shape-only** rules (research Decision 5). On failure →
   **422** `invalid_key_format`, nothing stored, existing config untouched
   (FR-004, FR-014). No live provider call is made (FR-005).
3. Call `public.set_workspace_ai_key(workspace_id, provider, api_key)` (which
   re-asserts Owner and performs the Vault create/update — Decision 4).
4. **200** → `AiSettingsStatus` with `configured: true`, the new provider, and the
   new `masked_hint`. The response contains no key.

**Idempotency**: Calling `PUT` when already configured replaces in place (one
active provider + key remain; prior secret overwritten) — FR-002, FR-011–FR-013.

## DELETE `/workspaces/{workspace_id}/ai-settings`

Remove/clear the workspace's key. **Owner only** — FR-020.

- Not a member → **404**. Member but not Owner → **403**.
- Calls `public.clear_workspace_ai_key(workspace_id)` (destroys the Vault secret
  and deletes the row).
- **200** → `AiSettingsStatus` with `configured: false` and null fields.
- **No-op safe**: `DELETE` when nothing is configured still returns **200**
  not-configured (FR-016).

## Contract test checklist (backend)

- [ ] GET returns not-configured status when no row exists; configured status
      (provider + masked_hint + updated_*) after a PUT.
- [ ] GET is allowed for Owner/Admin/Member/Viewer members; **404** for a
      non-member and for anon (401).
- [ ] PUT by Owner with a valid-shape key → 200 configured; response body,
      headers, and server logs contain **no** portion of the key beyond the last-4
      `masked_hint` (SC-002).
- [ ] PUT with empty/whitespace/malformed key → 422 `invalid_key_format`, nothing
      stored, prior config unchanged.
- [ ] PUT missing provider or with an unsupported provider → 422.
- [ ] PUT by Admin/Member/Viewer → 403; by non-member → 404 (SC-003).
- [ ] PUT again (same provider = rotate; other provider = switch) → exactly one
      active config; prior secret no longer decryptable (SC-006).
- [ ] DELETE by Owner → 200 not-configured; secret unrecoverable (SC-005); DELETE
      again → 200 no-op.
- [ ] DELETE by Admin/Member/Viewer → 403; by non-member → 404.
- [ ] Cross-workspace: a member of workspace B gets 404 for workspace A's
      settings on GET/PUT/DELETE (SC-007).
