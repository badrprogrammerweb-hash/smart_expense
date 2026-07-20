import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Row actions, user menu, workspace actions" viewport="260x160"
 */
export interface DropdownMenuItem { label: string; onClick?: () => void; disabled?: boolean; destructive?: boolean; divider?: boolean; }
export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items?: DropdownMenuItem[];
  align?: 'start' | 'end';
  /** Minimum/preferred menu width in px — keep small for compact menus (e.g. language picker) to avoid blank space */
  menuMinWidth?: number;
  /** Fixed panel width as a CSS value (e.g. 'min(320px, calc(100vw - 32px))'); overrides menuMinWidth/max-content sizing */
  menuWidth?: string;
  /** Text direction for the popup panel (defaults 'rtl'); pass 'ltr' for English content so text left-aligns */
  dir?: 'rtl' | 'ltr';
}
export declare function DropdownMenu(props: DropdownMenuProps): JSX.Element;
