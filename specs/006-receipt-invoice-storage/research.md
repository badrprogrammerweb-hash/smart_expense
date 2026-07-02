# Phase 0 Research: Receipt and Invoice Storage

All Technical Context items resolved — no NEEDS CLARIFICATION remain. Decisions
below capture the non-obvious choices and the alternatives rejected.

## Decision 1 — Bytes flow through the backend (proxy upload), not direct-to-Storage

**Decision**: The browser uploads file bytes to a FastAPI endpoint
(`multipart/form-data`). The backend authorizes the caller, validates the real
content type and size, then writes the object to the private `receipts` bucket
using the **service-role key**, and finally inserts the `files` metadata row.
Downloads/previews are served by the backend returning a **short-lived signed
URL** minted with the service-role key.

**Rationale**:
- Constitution IX / VI require server-side validation of every protected
  action; content-type sniffing (FR-004) and size enforcement (FR-003) must
  happen where the client cannot bypass them. A direct-to-Storage signed
  **upload** URL would let a client PUT arbitrary bytes/types after the URL is
  issued, defeating FR-002/FR-004.
- Keeps the service-role key strictly server-side (constitution IX; the key is
  already only in `apps/api` config, never shipped to `apps/web`).
- The metadata row is created only after the object write succeeds, avoiding
  orphan rows (spec Edge Case "interrupted upload").

**Alternatives considered**:
- *Direct-to-Storage signed upload URL from the frontend*: fewer backend bytes
  but cannot enforce real content-type/size server-side and would require
  Storage RLS to be the sole gate — rejected per constitution.
- *Frontend uses `supabase-js` Storage client with the user session*: would
  require the private bucket to trust Storage RLS alone and exposes bucket
  operations to the browser — rejected; backend stays the authority.

## Decision 2 — Metadata in a dedicated `files` table with soft delete

**Decision**: A new `public.files` table holds all metadata; deletion is a
soft delete (`status='deleted'`, `deleted_at`, `deleted_by` set) while the
Storage object is removed. The row is never hard-deleted in this phase.

**Rationale**: Constitution VIII and FR-017 require metadata to persist for
history/traceability after the binary is gone. Mirrors the existing
soft-delete pattern already used by `incomes`/`expenses`
(`status in ('confirmed','deleted')`, `deleted_at`), so the codebase stays
consistent.

**Alternatives considered**: Hard delete with a separate audit log — rejected
as more moving parts than the established soft-delete convention needs.

## Decision 3 — File↔expense link is a nullable FK on `files`, not a join table

**Decision**: `files.expense_id uuid references public.expenses(id) on delete
set null` (nullable). A file links to at most one expense; an expense has zero
or more files. Deleting an expense nulls the link (file survives — FR-015).

**Rationale**: Matches the clarified cardinality (one expense ↔ many files)
with the simplest schema; `on delete set null` directly implements
"expense deleted ⇒ files unlinked, not deleted." A join table would only be
needed for many-to-many, which the spec explicitly excludes.

**Alternatives considered**: `expense_files` join table (many-to-many) —
rejected, exceeds clarified cardinality and scope. Storing `file_id` on the
`expenses` row — rejected, cannot represent multiple files per expense.

## Decision 4 — Private bucket + short-lived signed URLs (minutes)

**Decision**: One **private** Storage bucket `receipts`; objects keyed
`{workspace_id}/{file_id}`. Preview/download uses a signed URL with a bounded
TTL (default 5 minutes / 300 s). No public bucket, no `getPublicUrl`.

**Rationale**: Constitution VIII forbids public file access for financial
documents; FR-011 requires access grants to expire. A minutes-scale TTL is
long enough to open/download once and short enough to not function as a
durable public link. The `{workspace_id}/` path prefix supports workspace-
scoped storage policies as defense in depth.

**Alternatives considered**: Long-lived (hours/days) signed URLs — rejected,
weakens FR-011. Streaming bytes back through the API for every download —
viable but heavier; signed URLs are the Supabase-idiomatic private-access
mechanism and still fully backend-authorized (URL is only minted after the
backend authorizes the caller).

## Decision 5 — Authorization enforced in both backend and RLS

**Decision**: The `files` table has RLS policies using the existing
`public.is_workspace_member(ws, uid)` and `public.workspace_role_for(ws, uid)`
helpers (defense in depth), **and** the backend service layer re-checks the
caller's role before every service-role Storage operation and before every
mutating metadata write.

**Rationale**: Constitution IX: "RLS alone is not sufficient — every protected
action MUST be validated on the backend." Service-role Storage calls bypass
RLS entirely, so the only gate on object bytes is the backend check; RLS still
protects the metadata table for any direct DB path. This mirrors the Phase 3
"RLS as enforced boundary + app checks" approach.

**Role matrix (applied in both layers where expressible)**:

| Action | Owner | Admin | Member | Viewer |
|--------|:-----:|:-----:|:------:|:------:|
| Upload | ✅ | ✅ | ✅ | ❌ |
| List / preview / download | ✅ | ✅ | ✅ | ✅ |
| Link / detach file ↔ expense | ✅ | ✅ | ✅ | ❌ |
| Delete file (soft) | ✅ | ✅ | ❌ | ❌ |
| Change auto-delete setting | ✅ | ❌ | ❌ | ❌ |

**Note on RLS granularity**: soft-delete and linking are both `UPDATE`s on
`files`. RLS `UPDATE` policy allows Owner/Admin broadly and Member only on rows
they uploaded; the finer split (Member may link/detach but may **not**
soft-delete) is enforced in the backend service layer, which is the
authoritative gate per constitution IX.

## Decision 6 — Real content-type validation and limits

**Decision**: Accept only `image/png`, `image/jpeg`, `image/webp`,
`application/pdf`. Validate by sniffing magic bytes / decoding the leading
bytes server-side, not by trusting the client-declared MIME or extension.
Reject > 10 MB and 0-byte uploads before writing to Storage.

**Rationale**: FR-002/FR-004/FR-005 and spec edge cases (renamed executable,
zero-byte). Sniffing the first bytes (PDF `%PDF-`, PNG `\x89PNG`, JPEG
`\xFF\xD8\xFF`, WebP `RIFF....WEBP`) is dependency-free and sufficient for the
four supported types. The 10 MB cap is a chosen, tunable value that makes the
requirement testable without a per-workspace quota (out of scope).

**Alternatives considered**: Trust client `Content-Type` — rejected, spoofable.
Add a heavy file-type library — rejected, four fixed signatures need no new
dependency.

## Decision 7 — Auto-delete preference is an inert workspace boolean this phase

**Decision**: Add `workspaces.auto_delete_after_extraction boolean not null
default false`. It is read/written by workspace settings (Owner-only) and shown
in the UI. **No code path consumes it this phase** — extraction is Phase 8.

**Rationale**: FR-019/FR-020/FR-022 and constitution VIII ("permanent by
default"). Storing the preference now readies Phase 8 without introducing any
deletion behavior; a single boolean avoids over-modeling the
"after-confirmation vs immediate" nuance the doc leaves to the extraction
phase. This is an intentional scope boundary, explicitly documented so
`/speckit-analyze` does not flag it as an unconsumed requirement.

**Alternatives considered**: Multiple fields (mode enum, delay) — rejected,
premature until extraction defines what it needs. Deferring the setting to
Phase 8 entirely — rejected, the Phase 6 exit criteria require the setting to
be available now.

## Decision 8 — Testing strategy for Storage without over-coupling to a live bucket

**Decision**: Authorization, validation, linkage, and soft-delete logic are
tested at the FastAPI route/service layer with the Supabase Storage boundary
(`services/storage.py`) exercised against the local Supabase emulator when
present and otherwise stubbed. Privacy/isolation assertions (SC-002) are tested
by attempting cross-workspace and anonymous access and asserting denial.

**Rationale**: Keeps the "100% private / 100% isolation" success criteria
directly testable and fast, following the Phase 2–4 precedent of signing in as
real local-Auth users to exercise RLS/roles, while not making CI depend on a
live hosted bucket.

**Alternatives considered**: Only mocking, never touching real Storage —
rejected, would not exercise the bucket path/signing. Always requiring a live
bucket — rejected, brittle in CI.
