# Contract: Workspace Members API

Resolves FR-009–FR-017, FR-020, FR-030–FR-032. Every endpoint here requires
the session validation described in `contracts/session-validation.md`, and
operates on `{workspace_id}` paths where the caller must already be a
member (otherwise `404` per that contract).

## `GET /workspaces/{workspace_id}/members`

Lists all members of the workspace (FR-020). Any role, including Viewer,
may call this — read access is allowed for all roles (User Story 3,
scenario 4).

**Response** `200 OK`:

```json
{
  "members": [
    { "user_id": "uuid", "email": "owner@example.com", "role": "owner" },
    { "user_id": "uuid", "email": "member@example.com", "role": "member" }
  ]
}
```

## `POST /workspaces/{workspace_id}/members`

Adds an existing user to a **team** workspace by email (FR-009). Caller
must be Owner or Admin (FR-013, FR-014).

**Request**:

```json
{ "email": "newmember@example.com", "role": "member" }
```

`role` must be one of `admin`, `member`, `viewer` — `owner` is rejected
here regardless of caller role (Research Decision 7: only the role-update
endpoint below, called by an existing Owner, can grant Owner).

**Response** `201 Created`:

```json
{ "user_id": "uuid", "email": "newmember@example.com", "role": "member" }
```

**Errors**:

| Condition | Status | `error.code` |
|---|---|---|
| Caller is Member/Viewer | `403` | `forbidden` |
| Target workspace is `type: "personal"` | `403` | `forbidden` |
| `email` does not match any existing account | `404` | `user_not_found` — generic, does not confirm or deny whether the email has an account beyond "no match to add" (spec edge case: must not expose private account data) |
| Target user is already a member of this workspace | `409` | `already_a_member` (FR-032) — existing role is left unchanged |
| Workspace already has 10 members | `409` | `member_limit_reached` (FR-030) |
| `role` is `owner` or any value outside the fixed set | `422` | `invalid_role` (FR-011) |

## `PATCH /workspaces/{workspace_id}/members/{user_id}`

Changes a member's role (FR-013, FR-014; Research Decision 7).

**Request**:

```json
{ "role": "admin" }
```

**Authorization**:

- Owner caller: may set any role, including promoting a member to `owner`
  (this is how an Owner creates a co-Owner before leaving, FR-031).
- Admin caller: may set `admin`/`member`/`viewer`, only when the target's
  **current** role is not `owner`. An Admin attempting to change an Owner's
  role, or to grant `owner`, receives `403`.
- Member/Viewer caller: always `403`.

**Response** `200 OK`:

```json
{ "user_id": "uuid", "email": "member@example.com", "role": "admin" }
```

**Errors**: `422` `invalid_role` for any value outside the fixed set
(FR-011).

## `DELETE /workspaces/{workspace_id}/members/{user_id}`

Removes another member from the workspace (FR-013, FR-014, FR-017). Caller
must be Owner or Admin; an Admin cannot remove an Owner.

**Response**: `204 No Content`.

**Errors**:

| Condition | Status | `error.code` |
|---|---|---|
| Caller is Member/Viewer | `403` | `forbidden` |
| Admin caller targeting an Owner | `403` | `forbidden` |
| Target is the workspace's sole remaining Owner | `409` | `last_owner_protected` (FR-017) |

## `DELETE /workspaces/{workspace_id}/members/me`

Voluntary leave (FR-031). Any member, including the caller, may remove
their own membership — except a sole remaining Owner.

**Response**: `204 No Content`. The caller's next request against this
`workspace_id` receives `404` (no longer a member, per
`contracts/session-validation.md`), satisfying SC-008.

**Errors**:

| Condition | Status | `error.code` |
|---|---|---|
| Caller is the workspace's sole remaining Owner | `409` | `last_owner_protected` — must promote another member to Owner first (FR-017) |
| Target workspace is `type: "personal"` | `403` | `forbidden` — a personal workspace's sole membership is not "leavable"; it is not a team collaboration space (spec Assumptions) |

## Out of scope for this phase

No invitation/pending-acceptance state, no invite links, and no bulk member
import exist (spec Assumptions). No ownership-transfer endpoint exists
separately from the role-update endpoint above — promoting a co-Owner via
`PATCH .../members/{user_id}` is the only mechanism, and it does not
demote the promoting Owner.
