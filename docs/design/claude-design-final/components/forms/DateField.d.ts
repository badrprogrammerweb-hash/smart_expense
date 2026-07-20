import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Read-only date field with an inline calendar popover (year/month/day) — no separate dialog, selects and closes in one step" viewport="320x260"
 */
export interface DateFieldProps {
  label?: string;
  /** Value as DD/MM/YYYY */
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  /** Drives dir/mirroring and month/weekday/placeholder translations */
  lang?: 'ar' | 'en';
}
export declare function DateField(props: DateFieldProps): JSX.Element;
