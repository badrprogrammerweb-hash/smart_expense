import React from 'react';
/**
 * @startingPoint section="Components" subtitle="First-run and empty-list guidance, never looks broken" viewport="440x260"
 */
export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  dir?: 'rtl' | 'ltr';
}
export declare function EmptyState(props: EmptyStateProps): JSX.Element;
