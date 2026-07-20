import React from 'react';
export interface CategoryPickerSub { value: string; label: string; icon: string; }
export interface CategoryPickerMain { value: string; label: string; icon: string; disabled?: boolean; subs?: CategoryPickerSub[]; }
export interface CategoryPickerSelection { value: string; label: string; icon: string; isSub?: boolean; mainLabel?: string; }
/**
 * @startingPoint section="Components" subtitle="Hierarchical main/subcategory picker — full-screen sheet on mobile, centered dialog on desktop (Phase 13 future state)" viewport="380x520"
 */
export interface CategoryPickerDialogProps {
  open: boolean;
  categories: CategoryPickerMain[];
  selected?: CategoryPickerSelection | null;
  onClose?: () => void;
  onSelect?: (selection: CategoryPickerSelection) => void;
  /** Called when a new category is saved from the nested create-category sheet: (newCategory, parentValueOrNull) */
  onCreateCategory?: (newCategory: { value: string; label: string; icon: string }, parentValue: string | null) => void;
  /** Shows the "+ إضافة فئة / + Add category" action in the header (gate by role — owner/admin) */
  canManageCategories?: boolean;
  title?: string;
  /** Drives dir/mirroring and chrome translations (header, close, add-category, create-category sheet) */
  lang?: 'ar' | 'en';
}
export declare function CategoryPickerDialog(props: CategoryPickerDialogProps): JSX.Element | null;
