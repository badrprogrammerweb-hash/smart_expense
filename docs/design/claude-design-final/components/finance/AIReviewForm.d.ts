import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Receipt + editable extracted fields + confirm/discard" viewport="700x360"
 */
export interface CategoryHierarchyItem { value: string; label: string; subs: { value: string; label: string }[]; }
export interface AIReviewFields { amount?: string; merchant?: string; date?: string; category?: string; mainCategory?: string; subCategory?: string; }
export interface AIReviewFormProps {
  receipt?: { src?: string; fileName?: string };
  status?: 'processing' | 'ready' | 'failed' | 'confirmed' | 'discarded';
  fields?: AIReviewFields;
  onFieldChange?: (key: keyof AIReviewFields, value: string) => void;
  /** Flat category list (legacy) — ignored when categoryHierarchy is provided */
  categoryOptions?: { value: string; label: string }[];
  /** Phase 13 future-state: main+sub category picker, AI-suggested via fields.mainCategory/subCategory */
  categoryHierarchy?: CategoryHierarchyItem[];
  /** Phase 12 future-state: shows a mismatch warning when different from workspaceCurrency */
  receiptCurrency?: string;
  workspaceCurrency?: string;
  errorMessage?: string;
  onConfirm?: () => void;
  onDiscard?: () => void;
  loading?: boolean;
}
export declare function AIReviewForm(props: AIReviewFormProps): JSX.Element;
