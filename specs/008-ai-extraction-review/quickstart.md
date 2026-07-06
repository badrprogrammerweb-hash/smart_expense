# Quickstart: Validate AI Extraction and Review

A runnable validation guide proving Phase 8 works end-to-end. It exercises the
constitutional non-negotiable first (the BYOK key is never exposed even though
this is the first phase that reads it), then the full trigger → review →
confirm/discard lifecycle, error handling, and the Phase 6 auto-delete
integration. Implementation details live in [plan.md](./plan.md),
[data-model.md](./data-model.md), and [contracts/](./contracts/).

## Prerequisites

- Local Supabase stack running (Docker containers already up).
- Migrations through `20260705000000_ai_extraction_review.sql` applied
  (`supabase db reset` or `supabase migration up`).
- `apps/api` running (`uvicorn app.main:app --reload`) with outbound provider
  calls **stubbed** for automated tests (`httpx.MockTransport`); for manual
  end-to-end verification, a real (test-tier) Gemini or OpenAI key configured
  as the workspace's BYOK key (Phase 7).
- `apps/web` running (`npm run dev`).
- Test users seeded per the Phase 5 e2e seeding steps: a team workspace where
  **O** is Owner, **A** is Admin, **M1**/**M2** are two different Members,
  **V** is Viewer; and a second workspace owned by a different user **X**.
- At least one uploaded, unlinked receipt file (Phase 6) in the team
  workspace, and BYOK configured (Phase 7) for that workspace.

## Scenario 1 — No extraction without BYOK (US1, FR-002)

1. In a workspace with no BYOK key configured, as M1, attempt to trigger
   extraction on an uploaded file.
2. Expect **409 `ai_not_configured`**, a clear message pointing to AI
   settings, and no extraction row created.
   ✅ FR-002 — manual-first / AI-optional holds even at the trigger boundary.

## Scenario 2 — Trigger and get a draft (US1, FR-001–FR-009)

1. Configure BYOK for the workspace (Phase 7), then as M1 trigger extraction
   on the uploaded file.
2. The call returns **200** with either `status: "ready_for_review"` and
   populated `draft` fields, or `status: "failed"` with a `failure_reason` —
   either way, in one synchronous request/response (no polling).
3. **Key-secrecy check (the non-negotiable, mirrors Phase 7 Scenario 2):**
   - Inspect the trigger response body and the API logs. Confirm **zero**
     occurrences of the configured BYOK key value anywhere:
     ```
     docker logs <api-container-or-uvicorn> 2>&1 | grep -F "<the configured key>" ; echo "exit=$?"
     ```
     Expect no match (grep exit 1).
   - Confirm `get_workspace_ai_key_for_extraction` is the only path that ever
     decrypts the secret:
     ```
     docker exec -i supabase_db_smart-expense-ai psql -U postgres -d postgres -tAc \
       "select count(*) from pg_proc where proname = 'get_workspace_ai_key_for_extraction';"  -- 1
     ```
4. Immediately re-trigger on the **same** file → **409
   `extraction_in_progress`** if the first is still `ready_for_review`
   (FR-003); confirm or discard it first to unblock.
   ✅ SC-001, SC-002.

## Scenario 3 — Review, correct, and confirm (US2, FR-010–FR-015)

1. As M1 (the triggerer), open the extraction from Scenario 2. Every draft
   field is visible alongside the file preview.
2. Correct one field (e.g. fix the amount), then confirm.
3. Confirm the response is **200** `status: "confirmed"` with a non-null
   `expense_id`. Verify:
   - Exactly one new expense exists with the corrected amount and
     `currency: "SAR"` regardless of any non-SAR `extracted_currency` shown on
     the draft.
   - The dashboard/report totals now include this expense.
   - The source file shows this expense as its link.
4. Submit an amount of `0` on a **different** draft → **422**, no expense
   created (FR-012).
5. Confirm the same extraction twice (simulate a double-submit) → the second
   call returns **409 `already_resolved`**; exactly one expense exists.
   ✅ SC-003, SC-004.

## Scenario 4 — Own-record rule for Members; Owner/Admin act on any (Clarifications, FR-011/013/017)

1. Produce a new `ready_for_review` extraction triggered by **M1**.
2. As **M2** (a different Member), attempt to confirm or discard it → **403**
   for both; M2 can still `GET` it and see the draft read-only (`can_edit:
   false, can_discard: false`).
3. As **O** or **A**, confirm or discard the same M1-triggered extraction →
   **200** succeeds (Owner/Admin act on any extraction).
   ✅ SC-007 (own-record half).

## Scenario 5 — Viewer is read-only everywhere (Clarifications, FR-005/010/016/018)

1. As **V**, attempt to trigger extraction → **403**.
2. As **V**, `GET` an existing extraction → **200** with the full `draft`
   visible, `can_edit: false`, `can_discard: false`.
3. As **V**, attempt confirm or discard → **403** for both.
   ✅ SC-007 (Viewer half).

## Scenario 6 — Discard without creating an expense (US3, FR-014)

1. Produce a `ready_for_review` extraction; as its triggerer, discard it.
2. Confirm no expense was created, the extraction shows `status: "discarded"`,
   and the source file still exists, unlinked, and can be re-extracted.
   ✅ SC-006 (discard half).

## Scenario 7 — Provider and file errors are handled safely (US4, FR-016–FR-019)

Using the stubbed `httpx` transport, force each condition in turn and trigger
extraction on a fresh, unlinked file each time:

1. Provider returns 401/403 → `status: "failed"`, `failure_reason:
   "invalid_key"`.
2. Provider returns 429 → `failure_reason: "rate_limited"`.
3. Provider call exceeds the timeout → `failure_reason: "timeout"`.
4. File bytes are unreadable/corrupt → `failure_reason: "unreadable_file"`.
5. Provider returns non-JSON or schema-mismatched content →
   `failure_reason: "malformed_response"`.
6. For every case: confirm the source file is byte-for-byte unchanged
   afterward, and confirm a subsequent trigger on the same file succeeds
   (FR-019, FR-022 — retry is just triggering again).
   ✅ SC-005.

## Scenario 8 — Auto-delete respects the Phase 6 setting (US5, FR-020/021/023/024)

1. As O, enable `auto_delete_after_extraction` for the workspace (Phase 6
   settings).
2. Trigger, review, and confirm an extraction. Confirm the file's binary is
   no longer retrievable afterward, while `public.files` still shows the row
   (marked deleted) and the resulting expense still references it having
   existed.
3. With the setting still on, produce a **failed** extraction and a
   **discarded** extraction on two other files → confirm neither file is
   deleted (deletion only ever follows a successful confirmation).
4. Turn the setting off and confirm a new extraction → the file binary is
   retained.
   ✅ SC-006 (auto-delete half).

## Scenario 9 — Tenant isolation (FR-025/026, SC-008)

1. As a member of workspace **X**, attempt every endpoint (trigger/list/get/
   confirm/discard) against the team workspace's file/extraction ids →
   **404** for all (existence not leaked).
2. Unauthenticated request to any extraction endpoint → **401**.

## Done / acceptance

All nine scenarios pass, and Scenario 2's key-secrecy check and Scenario 7's
error-classification check both show zero leaks of secret or raw provider
content. That maps to SC-001–SC-008 and the constitution VI/X/XIV
non-negotiables. Automated equivalents live in the
`apps/api/tests/test_extraction_*.py` suite and the Playwright trigger→
review→confirm/discard flow (see plan.md project structure).
