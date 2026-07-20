import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Primary/secondary/ghost/destructive action button" viewport="500x120"
 */
export interface ButtonProps {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  /** Lucide icon name */
  icon?: string;
  iconPosition?: 'start' | 'end';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}
export declare function Button(props: ButtonProps): JSX.Element;
