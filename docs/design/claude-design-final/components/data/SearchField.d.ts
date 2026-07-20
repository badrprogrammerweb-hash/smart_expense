import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Existing per-list search input" viewport="260x50"
 */
export interface SearchFieldProps {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}
export declare function SearchField(props: SearchFieldProps): JSX.Element;
