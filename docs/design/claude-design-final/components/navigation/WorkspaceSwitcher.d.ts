import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Current workspace + switch, separate from account menu" viewport="260x60"
 */
export interface Workspace { name: string; type?: string; }
export interface WorkspaceSwitcherProps {
  current?: Workspace;
  workspaces?: Workspace[];
  onSelect?: (w: Workspace) => void;
  /** Drives menu text direction/alignment and the create-workspace action label */
  lang?: 'ar' | 'en';
}
export declare function WorkspaceSwitcher(props: WorkspaceSwitcherProps): JSX.Element;
