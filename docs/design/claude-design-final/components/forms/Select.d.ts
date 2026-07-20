import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Category/workspace/role picker" viewport="360x110"
 */
export interface SelectOption { value: string; label: string; disabled?: boolean; }
export interface SelectProps {
  label?: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options?: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}
export declare function Select(props: SelectProps): JSX.Element;
