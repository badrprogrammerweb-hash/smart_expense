import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Mobile substitute for a table row" viewport="380x76"
 */
export interface MobileRecordCardProps {
  icon?: string;
  title: string;
  category?: string;
  date?: string;
  amount: string | number;
  kind?: 'income' | 'expense';
  status?: string;
  onClick?: () => void;
  currency?: string;
  /** Optional trailing action row (e.g. edit/delete icon buttons) rendered below a divider */
  actions?: React.ReactNode;
  /** Optional single compact control (e.g. a ⋮ menu button) pinned to the card's bottom-left corner, no divider/extra row */
  cornerAction?: React.ReactNode;
}
export declare function MobileRecordCard(props: MobileRecordCardProps): JSX.Element;
