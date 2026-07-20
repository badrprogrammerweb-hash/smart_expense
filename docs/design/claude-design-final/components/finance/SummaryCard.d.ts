import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Balance/income/expense totals — balance uses emphasis" viewport="260x140"
 */
export interface SummaryCardProps {
  label: string;
  amount: string;
  kind?: 'income' | 'expense' | 'neutral';
  /** Lucide icon name */
  icon?: string;
  trend?: string;
  /** Larger type — reserve for the single dominant remaining-balance card */
  emphasis?: boolean;
  dir?: 'rtl' | 'ltr';
  currency?: string;
}
export declare function SummaryCard(props: SummaryCardProps): JSX.Element;
