# Contract: AI Extraction category suggestion (delta on existing endpoints)

Resolves FR-018–FR-020. Extends
`../../008-ai-extraction-review/contracts/` — routes and auth are
unchanged; only the `ExtractionDraft` shape and the extraction pipeline's
category-resolution behavior change.

## `ExtractionDraft` (returned as part of `ExtractionRead`)

```json
{
  "amount_minor": 4550,
  "extracted_currency": "SAR",
  "occurred_on": "2026-07-18",
  "vendor_name": "Some Cafe",
  "suggested_category": "Restaurants",
  "suggested_category_id": "uuid-of-the-restaurants-main-category-or-a-subcategory"
}
```

`suggested_category_id` is `null` whenever the model's textual suggestion
did not exactly (case-insensitively) match an entry in the *active*
expense-category catalog snapshot given to it as candidates (research.md
Decision 9) — this includes the case where the only textual match would
have been a currently-disabled category, which is never offered to the
model in the first place (FR-020). `suggested_category` (raw text) is
always populated when the model returned any category-like text, even if
it didn't resolve to an id, so the user still sees the model's reasoning
during manual review.

## `POST /workspaces/{workspace_id}/expenses/extractions/{extraction_id}/confirm` (unchanged route)

`ConfirmExtractionRequest.category_id` is unchanged in shape. The reviewer
may leave it as the pre-filled `suggested_category_id`, replace it with
any other active category/subcategory id from the workspace's expense
tree, or clear it — only the value submitted at confirm time is persisted
on the resulting expense (FR-019). Validation errors match the `expenses`
`category_id` errors in `records-api.md`.

## Out of scope for this phase

No AI suggestion for `incomes` — Phase 7/8's AI extraction pipeline only
ever produces draft **expenses** from receipts/invoices; income records
have no AI-extraction entry point to extend.
