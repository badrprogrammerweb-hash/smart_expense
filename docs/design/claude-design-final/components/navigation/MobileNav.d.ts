import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Bottom tab bar, replaces sidebar under 768px" viewport="390x64"
 */
export interface MobileNavProps {
  active?: string;
  onNavigate?: (key: string) => void;
  /** Phase 12 future-state: switches labels between Arabic and English */
  lang?: 'ar' | 'en';
  dir?: 'rtl' | 'ltr';
}
export declare function MobileNav(props: MobileNavProps): JSX.Element;
