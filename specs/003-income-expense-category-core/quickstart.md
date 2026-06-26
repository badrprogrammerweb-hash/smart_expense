# Quickstart: Income, Expense, and Category Core

Validates this feature end-to-end against a local Supabase stack, proving
SC-001 through SC-006 from `spec.md` (SC-007 is a qualitative claim — no
technical-support request for category management — not separately
scripted here). Uses the endpoints defined in `contracts/incomes-api.md`,
`contracts/expenses-api.md`, and `contracts/categories-api.md`, on top of
the workspace/membership setup from
`specs/002-auth-workspace-foundation/quickstart.md`.

## Prerequisites

- Everything from `specs/002-auth-workspace-foundation/quickstart.md`
  (Supabase CLI, Docker running, backend runnable, `curl` and `jq`)
- This phase's migration applied (`supabase start` / `supabase db reset`
  picks up the new file under `supabase/migrations/` automatically)

## 1. Start the stack and set up a team workspace

```bash
supabase start
cd apps/api && uvicorn app.main:app --reload &
cd -
```

Sign up Alice (Owner), Bob (Member), and Carol (Viewer) the same way as
Phase 2's quickstart step 3, then create a team workspace as Alice and add
Bob and Carol:

```bash
curl -s -X POST http://localhost:8000/workspaces \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Family Budget"}' | tee workspace.json
WORKSPACE_ID=$(jq -r .id workspace.json)

curl -s -X POST http://localhost:8000/workspaces/$WORKSPACE_ID/members \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","role":"member"}'

curl -s -X POST http://localhost:8000/workspaces/$WORKSPACE_ID/members \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"carol@example.com","role":"viewer"}'
```

## 2. Confirm default categories exist with no setup call (SC-005, FR-016)

```bash
curl -s http://localhost:8000/workspaces/$WORKSPACE_ID/categories \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq '.categories | length'
```

Expected: `15` — the full Saudi-first default set, already present.

## 3. Record income and an expense manually (SC-001, SC-002)

```bash
# Time this section by hand — each call should complete well under 1 minute.
curl -s -X POST http://localhost:8000/workspaces/$WORKSPACE_ID/incomes \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"amount_minor":500000,"occurred_on":"2026-06-01","description":"Monthly salary"}' \
  | tee income.json
INCOME_ID=$(jq -r .id income.json)

CATEGORY_ID=$(curl -s http://localhost:8000/workspaces/$WORKSPACE_ID/categories \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq -r '.categories[] | select(.name=="Restaurants") | .id')
```

If validating this step before User Story 3's categories endpoints exist
(i.e., right after User Story 1, per `tasks.md` T019), the categories API
above isn't built yet — fetch the same default category id directly from
Postgres instead:

```bash
CATEGORY_ID=$(psql "$SUPABASE_DB_URL" -t -A -c \
  "select id from public.categories where workspace_id = '$WORKSPACE_ID' and name = 'Restaurants';")
```

```bash
curl -s -X POST http://localhost:8000/workspaces/$WORKSPACE_ID/expenses \
  -H "Authorization: Bearer $BOB_TOKEN" -H "Content-Type: application/json" \
  -d "{\"amount_minor\":4500,\"occurred_on\":\"2026-06-10\",\"category_id\":\"$CATEGORY_ID\",\"merchant_name\":\"Al Baik\"}" \
  | tee expense.json
EXPENSE_ID=$(jq -r .id expense.json)
```

Expected: `201` for both — Alice (Owner) can create income; Bob (Member)
can create an expense.

Confirm Bob cannot create income (FR-014):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  http://localhost:8000/workspaces/$WORKSPACE_ID/incomes \
  -H "Authorization: Bearer $BOB_TOKEN" -H "Content-Type: application/json" \
  -d '{"amount_minor":100000,"occurred_on":"2026-06-01"}'
```

Expected: `403`.

## 4. Verify confirmed totals reflect create/edit/delete immediately (SC-002, SC-003)

No totals/dashboard endpoint exists this phase (research.md Decision 11),
so sum the confirmed records directly from the list endpoints:

```bash
sum_confirmed_expenses() {
  curl -s http://localhost:8000/workspaces/$WORKSPACE_ID/expenses \
    -H "Authorization: Bearer $ALICE_TOKEN" \
    | jq '[.expenses[] | select(.status=="confirmed") | .amount_minor] | add'
}

sum_confirmed_expenses   # expect 4500 (just Bob's lunch)

# Edit the expense's amount
curl -s -X PATCH http://localhost:8000/workspaces/$WORKSPACE_ID/expenses/$EXPENSE_ID \
  -H "Authorization: Bearer $BOB_TOKEN" -H "Content-Type: application/json" \
  -d '{"amount_minor":5000}'

sum_confirmed_expenses   # expect 5000 — edit reflected immediately

# Delete the expense
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE \
  http://localhost:8000/workspaces/$WORKSPACE_ID/expenses/$EXPENSE_ID \
  -H "Authorization: Bearer $BOB_TOKEN"

sum_confirmed_expenses   # expect null/0 — deleted record excluded
```

Expected: the sum updates immediately after each step, and the deleted
expense no longer appears in the list at all (no restore path,
Clarification 3).

## 5. Verify role enforcement across income, expense, and category actions (SC-004)

```bash
# Carol (Viewer) cannot create an expense
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  http://localhost:8000/workspaces/$WORKSPACE_ID/expenses \
  -H "Authorization: Bearer $CAROL_TOKEN" -H "Content-Type: application/json" \
  -d '{"amount_minor":1000,"occurred_on":"2026-06-11"}'
# Expected: 403

# Bob (Member) cannot create a category
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  http://localhost:8000/workspaces/$WORKSPACE_ID/categories \
  -H "Authorization: Bearer $BOB_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Pets"}'
# Expected: 403

# Alice (Owner) can create a category
curl -s -X POST http://localhost:8000/workspaces/$WORKSPACE_ID/categories \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Pets"}'
# Expected: 201
```

Create a second expense as Bob, then confirm a different Member cannot
edit it (a second team Member, "Dave", added the same way as Bob in step
1) while Alice (Owner) can:

```bash
curl -s -X POST http://localhost:8000/workspaces/$WORKSPACE_ID/expenses \
  -H "Authorization: Bearer $BOB_TOKEN" -H "Content-Type: application/json" \
  -d '{"amount_minor":2000,"occurred_on":"2026-06-12"}' | tee bobs_expense.json
BOBS_EXPENSE_ID=$(jq -r .id bobs_expense.json)

curl -s -o /dev/null -w "%{http_code}\n" -X PATCH \
  http://localhost:8000/workspaces/$WORKSPACE_ID/expenses/$BOBS_EXPENSE_ID \
  -H "Authorization: Bearer $DAVE_TOKEN" -H "Content-Type: application/json" \
  -d '{"amount_minor":2500}'
# Expected: 403 (FR-013 — Dave didn't create this expense)

curl -s -o /dev/null -w "%{http_code}\n" -X PATCH \
  http://localhost:8000/workspaces/$WORKSPACE_ID/expenses/$BOBS_EXPENSE_ID \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"amount_minor":2500}'
# Expected: 200 (FR-012 — Owner may edit any expense)
```

## 6. Verify cross-workspace isolation (SC-006)

Using Alice's personal workspace id (`personal_workspace_id` helper from
Phase 2's quickstart), confirm Bob cannot reach it at all:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  http://localhost:8000/workspaces/$ALICE_PERSONAL_ID/incomes \
  -H "Authorization: Bearer $BOB_TOKEN"
```

Expected: `404` — identical to a request against a non-existent
workspace, per `session-validation.md`.

## 7. Verify category name uniqueness and archive behavior (FR-018, FR-020, FR-021)

```bash
# Duplicate name rejected
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  http://localhost:8000/workspaces/$WORKSPACE_ID/categories \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"pets"}'
# Expected: 409 (case-insensitive match against the "Pets" category from step 5)

PETS_ID=$(curl -s http://localhost:8000/workspaces/$WORKSPACE_ID/categories \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq -r '.categories[] | select(.name=="Pets") | .id')

curl -s -X PATCH http://localhost:8000/workspaces/$WORKSPACE_ID/categories/$PETS_ID \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"is_archived":true}'
# Expected: 200, is_archived: true

# Same name can now be reused
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  http://localhost:8000/workspaces/$WORKSPACE_ID/categories \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Pets"}'
# Expected: 201 — the archived category no longer blocks the name
```

## Done

If steps 1–7 all produce their expected results, this feature's success
criteria (SC-001–SC-006) are satisfied, and the database-level rules from
`data-model.md`/`research.md` (default category seeding, soft delete, last
-write-wins, category uniqueness scope, role-based RLS) are exercised
exactly as a real client would trigger them.
