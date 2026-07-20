import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Currency-suffixed numeric field, LTR isolated" viewport="360x110"
 */
export interface AmountInputProps {
  label?: string;
  required?: boolean;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Tints the value for income vs expense context; "pending" is amber for an unconfirmed AI suggestion */
  kind?: 'income' | 'expense' | 'neutral' | 'pending';
  /** Currency suffix shown in the field, e.g. 'ر.س' or 'SAR' */
  currency?: string;
  error?: string;
  disabled?: boolean;
}
export declare function AmountInput(props: AmountInputProps): JSX.Element;
