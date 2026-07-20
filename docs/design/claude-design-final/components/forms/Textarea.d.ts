import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Notes field for records" viewport="360x140"
 */
export interface TextareaProps {
  label?: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  helper?: string;
  error?: string;
  disabled?: boolean;
}
export declare function Textarea(props: TextareaProps): JSX.Element;
