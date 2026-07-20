import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Lucide icon by name, with a neutral fallback square" viewport="200x80"
 */
export interface IconProps {
  /** Lucide icon name, e.g. "wallet", "plus", "check" */
  name: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
}
export declare function Icon(props: IconProps): JSX.Element;
