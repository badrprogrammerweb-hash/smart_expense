import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Workspace switcher (start) + account menu (end)" viewport="700x64"
 */
export interface TopHeaderProps {
  user?: { name: string; role: string };
  workspace?: { name: string; type?: string };
  workspaces?: { name: string; type?: string }[];
  onSelectWorkspace?: (w: any) => void;
  onMenu?: () => void;
  /** Phase 12 future-state: renders LanguageSwitcher (separate control from WorkspaceSwitcher) when provided */
  lang?: 'ar' | 'en';
  onLangChange?: (lang: 'ar' | 'en') => void;
}
export declare function TopHeader(props: TopHeaderProps): JSX.Element;
