import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Generic section container — recent records, category list" viewport="360x220"
 */
export interface InfoCardProps {
  title?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  padded?: boolean;
  dir?: 'rtl' | 'ltr';
}
export declare function InfoCard(props: InfoCardProps): JSX.Element;
