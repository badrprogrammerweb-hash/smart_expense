# Security Review

## Header

| Field | Value |
|-------|-------|
| Scope | Assembled Phases 2-9 MVP: backend `apps/api`, frontend `apps/web`, Supabase Postgres/Auth/Vault/Storage. |
| Method | Checklist-driven internal manual review cross-referenced to the automated acceptance suite; not a third-party audit or penetration test. |
| Date |  |
| Reviewer |  |
| Commit reviewed |  |

## Section VI - Privacy & Security

| Check ID | Statement | Verdict | Evidence/Test Ref | Finding Ref |
|----------|-----------|---------|-------------------|-------------|
| SR-VI-01 | Workspace-based tenant isolation enforced for tenant-owned data. |  |  |  |
| SR-VI-02 | Role-based permissions enforced on the backend for every protected action, not frontend-only. |  |  |  |
| SR-VI-03 | File storage is private by default; no public URLs for financial documents. |  |  |  |
| SR-VI-04 | BYOK AI key stored in Supabase Vault; never exposed to the frontend. |  |  |  |
| SR-VI-05 | AI key never appears in API responses, logs, or error messages. |  |  |  |
| SR-VI-06 | No sensitive data such as keys, tokens, or financial PII in logs or error text. |  |  |  |
| SR-VI-07 | Supabase RLS enabled for tenant-owned tables. |  |  |  |

## Section VII - Multi-Tenant Isolation

| Check ID | Statement | Verdict | Evidence/Test Ref | Finding Ref |
|----------|-----------|---------|-------------------|-------------|
| SR-VII-01 | No cross-workspace read for income, expenses, categories, files, reports, or history. |  |  |  |
| SR-VII-02 | No cross-workspace write. |  |  |  |
| SR-VII-03 | Unauthenticated requests to protected resources denied. |  |  |  |
| SR-VII-04 | Viewer role cannot modify any workspace record. |  |  |  |
| SR-VII-05 | Every business record is workspace-scoped. |  |  |  |

## Section IX - Architecture Authority

| Check ID | Statement | Verdict | Evidence/Test Ref | Finding Ref |
|----------|-----------|---------|-------------------|-------------|
| SR-IX-01 | Financial calculations owned by the backend; frontend is display-only. |  |  |  |
| SR-IX-02 | Authorization and role validation performed on the backend/database, not the frontend. |  |  |  |
| SR-IX-03 | Supabase Postgres is the source of truth; frontend cannot override backend/DB truth. |  |  |  |

## Section X - Financial Accuracy

| Check ID | Statement | Verdict | Evidence/Test Ref | Finding Ref |
|----------|-----------|---------|-------------------|-------------|
| SR-X-01 | Money stored and computed as integer minor units; no floating-point money. |  |  |  |
| SR-X-02 | Remaining balance equals confirmed income minus confirmed expenses, always. |  |  |  |
| SR-X-03 | Draft, pending, failed, or unconfirmed AI records never affect totals. |  |  |  |
| SR-X-04 | Edits and deletes immediately recalculate totals; deleted records are excluded. |  |  |  |
| SR-X-05 | Constitution-required financial edge states are all tested. |  |  |  |

## Findings Summary

| Failed Check | Finding ID | Severity | Area |
|--------------|------------|----------|------|

| Severity | Count |
|----------|-------|
| Critical |  |
| High |  |
| Medium |  |
| Low |  |

| Area | Count |
|------|-------|
| financial-accuracy |  |
| tenant-isolation |  |
| role-permissions |  |
| file-privacy |  |
| ai-behavior |  |
| localization |  |
| deployment |  |
| other |  |

Release-blocker findings: 
