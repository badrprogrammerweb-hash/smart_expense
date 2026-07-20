import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Desktop record table — RTL-correct alignment" viewport="700x260"
 */
export interface TableColumn { key: string; label: string; align?: 'start' | 'end' | 'center'; render?: (row: any) => React.ReactNode; /** Fixed column width (px number or CSS value) — use for an actions column so it never gets clipped */ width?: number | string; }
export interface TableProps {
  columns?: TableColumn[];
  rows?: any[];
  rowKey?: string;
  onRowClick?: (row: any) => void;
  dir?: 'rtl' | 'ltr';
  emptyLabel?: string;
}
export declare function Table(props: TableProps): JSX.Element;
