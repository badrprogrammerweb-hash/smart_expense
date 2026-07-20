# Contract: User Language Preference API

New minimal router (`apps/api/app/routes/users.py`, mounted with no
`/workspaces` prefix — this is account-level, not workspace-scoped). Resolves
FR-001, FR-002, FR-003, FR-004, FR-005.

## `GET /me`

Returns the caller's own profile including their stored locale preference. No
role/workspace check — any authenticated user may read their own profile.

**Response** `200 OK`:

```json
{ "id": "uuid", "email": "user@example.com", "display_name": "Name", "locale": "en" }
```

`401` if unauthenticated (existing `get_current_user` dependency behavior,
unchanged).

## `PATCH /me`

Updates the caller's stored locale preference.

**Request**:

```json
{ "locale": "ar" }
```

`locale` MUST be one of `"en"` / `"ar"`; any other value → `422` with
`{"code": "invalid_request", ...}` (existing Pydantic validation-error shape
used elsewhere in the API, e.g. `apps/api/app/routes/workspaces.py`'s
`create_workspace`).

**Response** `200 OK`:

```json
{ "id": "uuid", "locale": "ar" }
```

The value persists and is returned by subsequent `GET /me` calls, from any
device/session (FR-001, FR-003).

## Frontend integration points (for tasks.md, not part of the wire contract)

- The sign-in flow calls `GET /me` once after establishing a session and, if
  no `NEXT_LOCALE` cookie is present yet and the returned `locale` differs
  from the current path's locale segment, redirects to the equivalent path
  under the preferred locale (see `research.md` §2).
- `apps/web/components/settings/LanguageSwitcher.tsx` calls `PATCH /me` with
  the newly selected locale in addition to its existing path-swap navigation.
- No change to `apps/web/middleware.ts`'s per-request behavior.
