# Quickstart: Validate BYOK AI Settings

A runnable validation guide proving Phase 7 works end-to-end. It exercises the
constitutional non-negotiable first (the key is never exposed) and the full
configure → view → replace → remove lifecycle. Implementation details live in
[plan.md](./plan.md), [data-model.md](./data-model.md), and
[contracts/](./contracts/).

## Prerequisites

- Local Supabase stack running (Docker containers `supabase_db_smart-expense-ai`
  etc. are already up).
- Migration `20260704000000_byok_ai_settings.sql` applied
  (`supabase db reset` or `supabase migration up`).
- `apps/api` running (`uvicorn app.main:app --reload`) and `apps/web` running
  (`npm run dev`).
- Test users seeded per the Phase 5 e2e seeding steps, with at least one team
  workspace where user **O** is Owner, **A** is Admin, **M** is Member, **V** is
  Viewer; and a **second** workspace owned by a different user **X**.
- Two syntactically valid sample keys (fake, never real):
  `sk-test-0000000000000000abcd` (OpenAI shape) and
  `AIzaSyTEST-0000000000000000000000abcd` (Gemini shape).

## Scenario 1 — Not configured by default (US5, FR-017)

1. As O, open `/{locale}/w/{workspaceId}/settings`. The AI settings card shows
   **Not configured**, no provider, no hint.
2. Create an income, an expense, a category, upload a file, open a report — all
   succeed with no key configured.
   ✅ Manual workflows do not depend on BYOK (SC-004).

## Scenario 2 — Owner configures a key (US1, FR-001–FR-008)

1. As O, select provider **OpenAI**, paste the OpenAI sample key, Save.
2. The card now shows **Configured**, provider **OpenAI**, masked hint ending in
   the key's last 4 chars, and a last-updated time.
   ✅ SC-001 (visible in under a minute).
3. **Key-secrecy check (SC-002 — the non-negotiable):**
   - In browser devtools → Network, inspect the `PUT .../ai-settings` response and
     the subsequent `GET`. Confirm **no** field contains the full key — only the
     4-char hint.
   - Search the API logs for the submitted key value → **zero** matches:
     ```
     docker logs <api-container-or-uvicorn> 2>&1 | grep -F "0000000000000000abcd" ; echo "exit=$?"
     ```
     Expect no match (grep exit 1).
   - Confirm the secret is in Vault, not an app table:
     ```
     docker exec -i supabase_db_smart-expense-ai psql -U postgres -d postgres -tAc \
       "select count(*) from vault.secrets where name like 'workspace_ai_key:%';"   -- ≥ 1
     docker exec -i supabase_db_smart-expense-ai psql -U postgres -d postgres -tAc \
       "select key_last4 from public.workspace_ai_settings;"                          -- last 4 only
     ```

## Scenario 3 — Non-owners cannot manage, but can see status (FR-020/FR-021)

1. As A (Admin), M (Member), V (Viewer): the AI settings card is **read-only** —
   the provider/key form and Remove button are absent; the status is visible.
2. Direct API attempts by A/M/V:
   - `PUT .../ai-settings` → **403 forbidden** (SC-003).
   - `DELETE .../ai-settings` → **403 forbidden**.
   - `GET .../ai-settings` → **200** status (all members).

## Scenario 4 — Replace / rotate / switch (US3, FR-011–FR-014)

1. As O, Save a **different** OpenAI key → masked hint + last-updated change;
   still exactly one config.
2. As O, switch provider to **Gemini** with the Gemini sample key → provider
   becomes Gemini, hint updates.
3. Confirm exactly one active config and the prior secret is gone:
   ```
   docker exec -i supabase_db_smart-expense-ai psql -U postgres -d postgres -tAc \
     "select count(*) from public.workspace_ai_settings where workspace_id = '<ws>';"  -- exactly 1
   ```
   ✅ SC-006 (one active config; prior secret unrecoverable).
4. Submit an empty/garbage key → **422 invalid_key_format**, existing config
   unchanged (FR-014).

## Scenario 5 — Remove (US4, FR-015/FR-016)

1. As O, Remove the key (confirm dialog). Card returns to **Not configured**.
2. Confirm secret + row are gone:
   ```
   docker exec -i supabase_db_smart-expense-ai psql -U postgres -d postgres -tAc \
     "select count(*) from public.workspace_ai_settings where workspace_id = '<ws>';"  -- 0
   ```
   ✅ SC-005 (unrecoverable after removal).
3. Remove again → **200** no-op, no error (FR-016).

## Scenario 6 — Tenant isolation (FR-023, SC-007)

1. As O (owner of workspace 1), call `GET/PUT/DELETE` against workspace **X**'s id
   → **404 not_found** for all three (existence not leaked).
2. Unauthenticated request to any `.../ai-settings` → **401**.

## Scenario 7 — Manual-first unaffected when configured (US5, FR-018/FR-019)

1. With a key configured, repeat Scenario 1's manual flow → identical results; no
   AI processing is triggered; dashboard totals and remaining balance are
   unchanged whether or not a key is set (SC-004).

## Done / acceptance

All seven scenarios pass, and the Scenario 2 key-secrecy check shows **zero**
occurrences of the raw key in any response or log. That maps to SC-001–SC-008 and
the constitution VI/XIV non-negotiables. Automated equivalents live in the
`apps/api/tests/test_ai_settings_*.py` suite and the Playwright BYOK flow (see
plan.md project structure).
