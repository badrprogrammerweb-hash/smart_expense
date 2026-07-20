import React from 'react';
/**
 * @startingPoint section="Components" subtitle="User-level AR/EN switch — separate from workspace switcher; Phase 12 future state" viewport="280x60"
 */
export interface LanguageSwitcherProps {
  lang?: 'ar' | 'en';
  onChange?: (lang: 'ar' | 'en') => void;
  className?: string;
  /** Renders a circular 44x44 icon-only button (single letter: ع / E) for tight mobile headers */
  compact?: boolean;
}
export declare function LanguageSwitcher(props: LanguageSwitcherProps): JSX.Element;
