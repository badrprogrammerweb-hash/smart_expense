-- Phase 13 (User Story 4): AI extraction category suggestion.
-- Persists the backend's resolved suggestion (research.md Decision 9) so it
-- can be returned in ExtractionDraft.suggested_category_id and pre-filled,
-- fully editable, during manual review (FR-018-FR-020).

alter table public.ai_extractions
    add column suggested_category_id uuid references public.categories(id) on delete set null;
