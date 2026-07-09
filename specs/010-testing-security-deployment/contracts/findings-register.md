# Contract: Remediation Findings Register (format)

Authoritative format for `specs/010-testing-security-deployment/findings-register.md`
(the living deliverable created in tasks). Row schema is E1 in `data-model.md`.

## Purpose

Make "no known issues remain" operational: it means **no _untracked_ known issues**.
Every defect or security weakness surfaced by a test or the security review gets a row
here with a stable id, severity, and status. Fixes are scheduled follow-up work —
**no product application code is changed in this phase** (FR-003), so `status` never
becomes "fixed here."

## Severity scale (fixed, four levels)

| Severity | Meaning |
|----------|---------|
| Critical | Breaks a non-negotiable: wrong financial total or cross-tenant data exposure with a plausible trigger. |
| High | Serious privacy/permission/financial weakness, narrower trigger or partial mitigation present. |
| Medium | Correctness or hardening gap without direct isolation/financial exposure. |
| Low | Minor/cosmetic/defense-in-depth improvement. |

## Release-blocker rule

`release_blocker = true` iff `severity ∈ {Critical, High}` AND
`area ∈ {financial-accuracy, tenant-isolation}`. Such findings are called out in the
readiness summary (FR-033) and must be remediated as follow-up before a real
production release, even though tracking them satisfies **this phase's** exit
criteria.

## Table format

```markdown
| ID | Title | Area | Severity | Source | Reproduction | Status | Remediation (owner/target) | Release-blocker |
|----|-------|------|----------|--------|--------------|--------|----------------------------|-----------------|
| F-001 | <one line> | tenant-isolation | High | test_acc_tenant_isolation.py::<t> | <steps> | Open | Phase 11 backend | yes |
```

- **Area** enum: `financial-accuracy`, `tenant-isolation`, `role-permissions`,
  `file-privacy`, `ai-behavior`, `localization`, `deployment`, `other`.
- **Status** enum: `Open`, `Triaged`, `Deferred`, `Fixed-elsewhere`.
- **IDs** are `F-NNN`, never reused.

## Empty-state (expected/allowed outcome)

If verification surfaces no defects, the register contains the table header and an
explicit note: "No findings recorded at phase completion." An empty register with the
suites green is the strongest exit state (all exit criteria met, no release blockers).

## Readiness summary block (appended to the register or security review)

At phase completion record:
- Backend/frontend suite result (pass/fail) and CI link.
- Count of findings by severity and by area.
- Explicit statement per exit criterion: MVP ready for review; no untracked tenant-
  isolation issues; no untracked financial-calculation issues; deployment documented
  and repeatable.
- List of `release_blocker = true` findings (or "none").
