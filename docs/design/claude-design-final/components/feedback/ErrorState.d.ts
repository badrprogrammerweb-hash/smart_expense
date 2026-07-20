import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Failed load / request, with a specific retry" viewport="440x260"
 */
export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}
export declare function ErrorState(props: ErrorStateProps): JSX.Element;
