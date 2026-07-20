# Manual Arabic/English RTL Checklist

Each row is a visual verification item for the core MVP surface in the named locale.

| Surface | Locale | Expected Direction | Pass | Fail | Notes |
|---------|--------|--------------------|------|------|-------|
| Dashboard | Arabic | RTL |  | X | Date range visually reorders and wraps in RTL; see F-001. SAR cards and labels render. |
| Dashboard | English | LTR | X |  | Dashboard labels and SAR cards render in LTR. |
| Income/expense entry | Arabic | RTL | X |  | Income and expense forms render localized RTL labels and controls. |
| Income/expense entry | English | LTR | X |  | Income and expense forms render localized LTR labels and controls. |
| Reports/summaries | Arabic | RTL | X |  | Reports headings, summary labels, and SAR rendering are localized. |
| Reports/summaries | English | LTR | X |  | Reports headings, summary labels, and SAR rendering are localized. |
| History | Arabic | RTL | X |  | Localized history heading and empty state render RTL. |
| History | English | LTR | X |  | Localized history heading and empty state render LTR. |
| Settings | Arabic | RTL | X |  | Localized settings and language controls render RTL. |
| Settings | English | LTR | X |  | Localized settings and language controls render LTR. |
| AI review | Arabic | RTL | X |  | Localized AI review empty state renders RTL. |
| AI review | English | LTR | X |  | Localized AI review empty state renders LTR. |

## 2026-07-21 Phase 12 Non-SAR Re-Verification

Re-walked the checklist against a workspace configured with `KWD` as its base currency. Existing Arabic/English direction expectations still hold for dashboard, income/expense entry, reports/summaries, history, settings, and AI review surfaces. Money values render with the workspace currency (`KWD`, including three fractional digits where amounts are present) instead of falling back to `SAR`.

| Surface | Locale | Expected Direction | Result | Notes |
|---------|--------|--------------------|--------|-------|
| Dashboard | Arabic | RTL | PASS | KWD summary amounts visible; layout remains RTL. |
| Dashboard | English | LTR | PASS | KWD summary amounts visible; layout remains LTR. |
| Income/expense entry | Arabic | RTL | PASS | Localized forms keep RTL alignment with KWD workspace context. |
| Income/expense entry | English | LTR | PASS | Localized forms keep LTR alignment with KWD workspace context. |
| Reports/summaries | Arabic | RTL | PASS | Report labels remain Arabic/RTL and currency output is workspace-aware. |
| Reports/summaries | English | LTR | PASS | Report labels remain English/LTR and currency output is workspace-aware. |
| History | Arabic | RTL | PASS | History heading/list state remains RTL; amount summaries use KWD when present. |
| History | English | LTR | PASS | History heading/list state remains LTR; amount summaries use KWD when present. |
| Settings | Arabic | RTL | PASS | Language, currency, and workspace settings render RTL. |
| Settings | English | LTR | PASS | Language, currency, and workspace settings render LTR. |
| AI review | Arabic | RTL | PASS | AI review route remains RTL under Arabic locale. |
| AI review | English | LTR | PASS | AI review route remains LTR under English locale. |
