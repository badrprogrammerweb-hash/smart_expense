import React from 'react';
/**
 * @startingPoint section="Components" subtitle="44px min touch target, requires an accessible label" viewport="300x100"
 */
export interface IconButtonProps {
  /** Lucide icon name */
  icon: string;
  /** Required accessible label (aria-label + title) */
  label: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'filled';
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
