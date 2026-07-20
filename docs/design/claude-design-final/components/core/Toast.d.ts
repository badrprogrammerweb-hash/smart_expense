import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Floating, auto-dismissing confirmation" viewport="400x120"
 */
export interface ToastProps {
  tone?: 'info' | 'success' | 'warning' | 'error';
  title: string;
  description?: string;
  onClose?: () => void;
}
export declare function Toast(props: ToastProps): JSX.Element;
