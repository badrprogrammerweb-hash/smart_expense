import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Loading placeholder — text/row/card variants" viewport="400x140"
 */
export interface SkeletonProps {
  variant?: 'text' | 'row' | 'card';
  width?: number | string;
  height?: number;
  count?: number;
}
export declare function Skeleton(props: SkeletonProps): JSX.Element;
