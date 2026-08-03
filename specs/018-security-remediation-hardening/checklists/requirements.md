# Specification Quality Checklist: Security Remediation and Production Hardening

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-30
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Validation Notes

### Iteration 1 findings (resolved before first save)

- **Implementation leakage** — initial drafting risked naming the concrete mechanism
  (`private` schema, `ALTER FUNCTION ... SET SCHEMA`, PostgREST, specific function names,
  `slowapi`, `/docs`). Rewritten to describe *what* must become true — "an internal grouping
  excluded from the published client-facing data API", "the machine-readable interface
  description" — leaving mechanism to plan.md. Routine identities are described by role
  ("the personal-workspace bootstrap routine") so FR-002 stays testable without prescribing
  a technology.
- **Unverifiable success criteria** — several criteria were restated requirements. Replaced with
  countable outcomes (SC-001 "zero times out of four", SC-005 "zero client-observable outputs",
  SC-015 "zero outbound requests").
- **Missing negative requirement** — FR-011 was added after review: the obvious-looking fix for
  the shared authorisation helpers (revoking run permission) would disable every tenant-isolation
  rule. Recording it as an explicit MUST NOT prevents a catastrophic "fix".
- **Deferred scope was implicit** — User Story 7 and FR-031 now state explicitly that the shared
  helper relocation is outside the release gate and may be dropped, so downstream analysis reads
  it as scoped-out rather than missed.
- **Unexamined published routines** — the Assumptions section now records that three further
  published routines (AI-key write, AI-key clear, extraction confirm) were examined and found
  safe, so their absence from the requirements is a decision rather than an oversight.

### Deliberate decisions

- **Zero [NEEDS CLARIFICATION] markers.** Every gap had a defensible conservative default, which
  is recorded in Assumptions. The genuinely open operational parameters — throttling thresholds,
  window lengths, counter scope, and whether the interface explorer is disabled outright or
  merely restricted — are deliberately left for `/speckit-clarify` to settle, since they are
  tuning decisions rather than specification gaps.
- **A corrected audit claim is excluded.** The audit originally asserted the identity-rewrite
  vulnerability also locked the victim out of their account. Re-verification showed the error is
  absorbed and the request proceeds, so no denial-of-service impact is claimed anywhere in this
  spec. Recorded in Assumptions for traceability.

### Iteration 2 — re-validation after `/speckit-clarify` (2026-07-30)

Five clarifications were integrated. Re-checked all 16 items against the updated spec: **16/16 →
16/16 passing**, no state changes, no regressions. What the session added:

- **Quantified the vague non-functional target.** "Limit how frequently" became explicit
  allowances and a fixed window in FR-017, so the throttling requirement is now testable rather
  than aspirational.
- **Closed three genuine gaps** that would otherwise have surfaced during implementation as
  unplanned decisions: counter scope (FR-023, with the instance-multiplication limitation recorded
  as accepted rather than hidden), failure mode (FR-024, fail closed), and localisation (FR-025 +
  SC-019 + User Story 3 scenario 7).
- **Pinned the reversal artifact's location** (FR-013), which matters because placing reversal
  statements in the applied change-history directory would cause every environment rebuild to
  execute them.
- **Amended one Assumption for accuracy.** The "no product behaviour changes" assumption now
  admits its single exception — the localised throttling message is a deliberate interface
  addition — so the assumption is not contradicted by FR-025.

Two new edge cases were added from the answers (per-instance multiplication, reset-on-restart) and
one Out-of-Scope entry (no new infrastructure dependency), keeping the throttling decision's
consequences visible rather than buried in the clarification log.

## Notes

- All 16 items pass. Spec is ready for `/speckit-plan`.
- Numbering verified contiguous: FR-001–FR-039, SC-001–SC-019.
