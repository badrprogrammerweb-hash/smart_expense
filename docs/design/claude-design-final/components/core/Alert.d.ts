import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Inline banner for info/success/warning/error" viewport="600x140"
 */
export interface AlertProps {
  tone?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children?: React.ReactNode;
  onDismiss?: () => void;
}
export declare function Alert(props: AlertProps): JSX.Element;
