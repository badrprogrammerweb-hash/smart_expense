# Contract: Workspaces API

Resolves FR-004–FR-008, FR-018, FR-019, FR-021, FR-029. Every endpoint here
requires the session validation described in
`contracts/session-validation.md`.

## `GET /workspaces`

Lists every workspace the caller is currently a member of (FR-018).

**Response** `200 OK`:

```json
{
  "workspaces": [
    { "id": "uuid", "type": "personal", "name": "My Workspace", "role": "owner" },
    { "id": "uuid", "type": "team", "name": "Family Budget", "role": "member" }
  ]
}
```

`role` is the caller's own role in that workspace, included so the frontend
(Phase 5) can render permission-aware UI without a second request. There is
always exactly one `type: "personal"` entry (FR-004/FR-005, and the
self-healing repair in Research Decision 3 if it was ever missing).

## `POST /workspaces`

Creates a new **team** workspace (FR-007). Personal workspaces are never
created through this endpoint — they only come from the signup bootstrap
(Research Decision 2).

**Request**:

```json
{ "name": "Family Budget" }
```

**Response** `201 Created`:

```json
{ "id": "uuid", "type": "team", "name": "Family Budget", "role": "owner" }
```

The caller becomes the workspace's Owner in the same transaction (FR-008) —
there is no intermediate state where the workspace exists without an Owner.

**Errors**: `422` if `name` is empty.

## `GET /workspaces/{workspace_id}`

Returns detail for one workspace the caller is a member of (FR-006,
FR-019).

**Response** `200 OK`:

```json
{ "id": "uuid", "type": "team", "name": "Family Budget", "role": "admin", "member_count": 4 }
```

**Errors**: `404` if the caller is not a member of `workspace_id` (or it
does not exist) — see `contracts/session-validation.md` for why this is a
`404`, not a `403`.

## Out of scope for this phase

No `PATCH`/`DELETE` on the workspace resource itself is exposed in this
phase beyond what `contracts/workspace-members-api.md` covers for
membership changes; workspace renaming is deferred until a UI needs it
(Phase 5) even though the underlying RLS `UPDATE` policy already allows it
(`data-model.md`). No archive or delete endpoint exists (FR-029).
