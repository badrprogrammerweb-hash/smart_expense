import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Flat bar/donut — no 3D, no gradients, no animation" viewport="400x240"
 */
export interface ChartDatum { label: string; value: number; color?: string; }
export interface ChartProps {
  type?: 'bar' | 'donut';
  data?: ChartDatum[];
  height?: number;
  valueKey?: string;
  labelKey?: string;
  color?: string;
}
export declare function Chart(props: ChartProps): JSX.Element;
