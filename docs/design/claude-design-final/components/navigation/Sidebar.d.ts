import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Right-anchored RTL desktop nav with workspace switcher" viewport="264x600"
 */
export interface SidebarProps {
  active?: string;
  onNavigate?: (key: string) => void;
  workspaceName?: string;
  pendingCount?: number;
  /** Phase 12 future-state: switches nav labels between Arabic and English */
  lang?: 'ar' | 'en';
  /** Defaults from lang (rtl for ar, ltr for en) — the sidebar sits on the start side either way */
  dir?: 'rtl' | 'ltr';
}
export declare function Sidebar(props: SidebarProps): JSX.Element;
