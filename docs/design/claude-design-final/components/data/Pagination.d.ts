import React from 'react';
/**
 * @startingPoint section="Components" subtitle="RTL-correct prev/next — right chevron = previous" viewport="320x60"
 */
export interface PaginationProps {
  page?: number;
  totalPages?: number;
  onChange?: (page: number) => void;
  /** Flips prev/next chevrons — rtl: next points left; ltr: next points right */
  dir?: 'rtl' | 'ltr';
  label?: string;
}
export declare function Pagination(props: PaginationProps): JSX.Element;
