import React from 'react';
/**
 * @startingPoint section="Components" subtitle="The 6 AI-extraction states, one fixed color mapping" viewport="200x60"
 */
export interface StatusBadgeProps {
  status: 'not_started' | 'processing' | 'ready' | 'confirmed' | 'failed' | 'discarded';
  /** Translates only 'ready'/'failed' labels to English; other statuses and Arabic (default) are unaffected */
  lang?: 'ar' | 'en';
}
export declare function StatusBadge(props: StatusBadgeProps): JSX.Element;
