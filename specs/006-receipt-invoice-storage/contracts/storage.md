# Contract: Private Storage (Backend-Mediated)

Resolves FR-007, FR-009, FR-010, FR-011, FR-024. Defines how object bytes are
stored and accessed. The browser never talks to Storage directly; the backend
`services/storage.py` is the only component that holds the service-role key and
performs object operations.

## Bucket

- Name: `receipts`. Created **private** (`public = false`) in the migration.
- Object key: `{workspace_id}/{file_id}` (UUIDs; no user-controlled path
  segment, preventing traversal and cross-workspace key collisions).
- No public read policy; `getPublicUrl` is never used (constitution VIII).

## Backend Storage operations (service role)

| Operation | Trigger | Guard before call |
|-----------|---------|-------------------|
| `put_object(key, bytes, content_type)` | `POST /files` after validation | Caller is Owner/Admin/Member of the workspace; type/size validated. |
| `sign_url(key, ttl=300s)` | `GET /files/{id}/download-url` | Caller is a member of the workspace; file `status='active'`. |
| `remove_object(key)` | `DELETE /files/{id}` | Caller is Owner/Admin of the workspace. |

Every operation is preceded by an explicit backend authorization check because
service-role calls bypass RLS (research Decision 5; constitution IX). The
workspace id in the key is derived from the authorized `files` row, never from
client input.

## Storage access policies (defense in depth)

Storage RLS policies on `storage.objects` for the `receipts` bucket restrict
direct object access to authenticated members of the workspace encoded in the
key's first path segment, using the same `is_workspace_member` helper. These
policies are a second layer; they are **not** the primary gate (the backend
check is), but they ensure that even a leaked anon/user token cannot read
another workspace's objects.

## Privacy guarantees (test targets — SC-002)

1. An unauthenticated request for any object or signed path is denied (`401` at
   the API; no valid signed URL is ever issued to anon).
2. A member of Workspace B cannot obtain a download URL for, or read, a
   Workspace A object (`404` at the API; storage policy denial as backstop).
3. A signed URL stops returning content after its TTL and after the object is
   removed by a soft delete (FR-011, FR-018).
