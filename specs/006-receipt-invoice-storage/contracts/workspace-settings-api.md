# Contract: Workspace Settings — Auto-Delete Preference

Resolves FR-020, FR-021, FR-022. Extends the existing workspaces API with read
and update of the `auto_delete_after_extraction` preference. Session validation
as in the Files API contract (`401` / `404` rules identical).

## Preference exposure on the workspace resource

`GET /workspaces` and `GET /workspaces/{workspace_id}` (existing) include an
additive field:

```json
{ "id": "uuid", "name": "Home", "auto_delete_after_extraction": false }
```

Default is `false` for every workspace (FR-020; constitution VIII "permanent by
default"). Any member incl. Viewer may read it (display only).

## `PATCH /workspaces/{workspace_id}`

Updates the auto-delete preference (FR-021). Caller must be the workspace
**Owner** — Admin/Member/Viewer → `403 {"code":"forbidden"}`.

**Request**:

```json
{ "auto_delete_after_extraction": true }
```

**Response** `200 OK`:

```json
{ "id": "uuid", "auto_delete_after_extraction": true }
```

The value persists and is returned on subsequent reads (FR-021).

## Inertness (FR-022)

Setting this flag has **no side effect** in this phase: no file is deleted, no
extraction is triggered, no background job runs. It only records the
workspace's preference for the future extraction phase (Phase 8). Tests MUST
assert that toggling the flag deletes zero files (SC-006).

> If the existing workspaces API has no `PATCH` route yet, this phase adds a
> minimal one that accepts **only** `auto_delete_after_extraction`; it does not
> introduce general workspace-settings editing (scope control).
