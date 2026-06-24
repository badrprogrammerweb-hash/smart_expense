# Quickstart: Authentication and Workspace Foundation

Validates this feature end-to-end against a local Supabase stack, proving
SC-001 through SC-008 from `spec.md`. Uses the endpoints defined in
`contracts/workspaces-api.md` and `contracts/workspace-members-api.md`.

## Prerequisites

- Everything from `specs/001-foundation/quickstart.md` (Node.js, Python,
  both shells runnable)
- Supabase CLI installed, with Docker running (required for `supabase
  start`)
- `curl` and `jq` (or any way to read JSON responses)

## 1. Start the local Supabase stack

```bash
supabase start
```

This applies every file under `supabase/migrations/` — the
`user_profiles`/`workspaces`/`workspace_memberships` tables, RLS policies,
and triggers from `data-model.md` — to a fresh local Postgres instance, and
prints local URLs/keys. Confirm in Supabase Studio (or via `supabase status`)
that **only the email/password provider is enabled** under Auth providers
(SC-007) — no OAuth provider should show as enabled. This manual check is
backed by an automated assertion (`test_auth_providers_disabled.py`); treat
this step as a sanity check, not the only safeguard.

## 2. Configure and start the backend

Copy the local stack's values from `supabase status` into `apps/api/.env`
(`SUPABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_JWT_SECRET` if applicable), then start the backend as in Phase 1:

```bash
cd apps/api
uvicorn app.main:app --reload
```

## 3. Sign up two users directly against local Auth (SC-001, SC-002)

```bash
curl -s "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"correct-horse-1"}' | tee alice.json

curl -s "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","password":"correct-horse-2"}' | tee bob.json
```

Save each response's `access_token` (`ALICE_TOKEN`, `BOB_TOKEN`). Time the
round trip from the first request to the next step — it must stay under 2
minutes (SC-001).

```bash
curl -s http://localhost:8000/workspaces -H "Authorization: Bearer $ALICE_TOKEN"
```

Expected: exactly one workspace, `type: "personal"`, `role: "owner"`
(SC-002) — created by the signup trigger with no extra call required.

## 4. Create a team workspace and add a member (SC-003)

```bash
curl -s -X POST http://localhost:8000/workspaces \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Family Budget"}' | tee workspace.json
WORKSPACE_ID=$(jq -r .id workspace.json)

curl -s -X POST http://localhost:8000/workspaces/$WORKSPACE_ID/members \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","role":"member"}'
```

Expected: `201` with `role: "member"`. Total elapsed time for this section
must stay under 3 minutes (SC-003). Confirm Bob now sees the workspace:

```bash
curl -s http://localhost:8000/workspaces -H "Authorization: Bearer $BOB_TOKEN"
```

## 5. Verify role enforcement (SC-004)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  http://localhost:8000/workspaces/$WORKSPACE_ID/members \
  -H "Authorization: Bearer $BOB_TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"carol@example.com","role":"viewer"}'
```

Expected: `403` — Bob is a Member, not Owner/Admin. Repeat for each role
combination called out in User Story 3's acceptance scenarios if doing a
full manual pass; this single check is the minimum to prove the gate works.

## 6. Verify tenant isolation (SC-005)

```bash
ALICE_PERSONAL_ID=$(curl -s http://localhost:8000/workspaces \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq -r '.workspaces[] | select(.type=="personal") | .id')

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/workspaces/$ALICE_PERSONAL_ID \
  -H "Authorization: Bearer $BOB_TOKEN"
```

Expected: `404` (not `403` — see `contracts/session-validation.md`). Bob is
not a member of Alice's personal workspace.

## 7. Verify duplicate-add rejection (FR-032)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  http://localhost:8000/workspaces/$WORKSPACE_ID/members \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","role":"admin"}'

curl -s http://localhost:8000/workspaces/$WORKSPACE_ID/members \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq '.members[] | select(.email=="bob@example.com")'
```

Expected: `409`, and Bob's role is still `member` (unchanged by the
rejected attempt).

## 8. Verify last-Owner protection and voluntary leave (FR-017, FR-031, SC-008)

```bash
# Alice (sole Owner) cannot leave yet
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE \
  http://localhost:8000/workspaces/$WORKSPACE_ID/members/me \
  -H "Authorization: Bearer $ALICE_TOKEN"
```

Expected: `409 last_owner_protected`.

```bash
BOB_ID=$(curl -s http://localhost:8000/workspaces/$WORKSPACE_ID/members \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq -r '.members[] | select(.email=="bob@example.com") | .user_id')

curl -s -X PATCH http://localhost:8000/workspaces/$WORKSPACE_ID/members/$BOB_ID \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"role":"owner"}'

curl -s -o /dev/null -w "%{http_code}\n" -X DELETE \
  http://localhost:8000/workspaces/$WORKSPACE_ID/members/me \
  -H "Authorization: Bearer $ALICE_TOKEN"
```

Expected: the `PATCH` succeeds (Bob is now a co-Owner), then Alice's leave
succeeds (`204`). Confirm Alice immediately loses access:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/workspaces/$WORKSPACE_ID \
  -H "Authorization: Bearer $ALICE_TOKEN"
```

Expected: `404` (SC-008 — access lost on the next protected action).

## 9. Confirm member cap (FR-030)

Without creating ten real users, confirm the trigger from
`data-model.md` exists and rejects an 11th `team`-membership insert once
the cap is reached — either by repeating step 4 with nine more
signed-up users, or by directly asserting the trigger in a backend
integration test (this is the approach actually used in CI; see
`research.md` Decision 9).

## Done

If steps 1–9 all produce their expected results, this feature's success
criteria (SC-001–SC-008) are satisfied.
