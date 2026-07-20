import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Underline tabs — reports periods, settings sections" viewport="500x50"
 */
export interface TabItem { key: string; label: string; }
export interface TabsProps {
  tabs?: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (key: string) => void;
}
export declare function Tabs(props: TabsProps): JSX.Element;
