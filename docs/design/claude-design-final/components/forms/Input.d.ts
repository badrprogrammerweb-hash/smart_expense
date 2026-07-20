import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Labeled text field with icon, helper and error states" viewport="360x120"
 */
export interface InputProps {
  label?: string;
  required?: boolean;
  helper?: string;
  error?: string;
  /** Lucide icon name, shown leading */
  icon?: string;
  disabled?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  dirOverride?: 'ltr' | 'rtl';
}
export declare function Input(props: InputProps): JSX.Element;
