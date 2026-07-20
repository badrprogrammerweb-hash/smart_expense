import React from 'react';
/**
 * @startingPoint section="Components" subtitle="DD/MM/YYYY, LTR isolated (fixes F-001)" viewport="360x110"
 */
export interface DateInputProps {
  label?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}
export declare function DateInput(props: DateInputProps): JSX.Element;
