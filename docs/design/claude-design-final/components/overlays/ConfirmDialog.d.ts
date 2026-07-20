import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Destructive-action confirmation, states the consequence" viewport="440x260"
 */
export interface ConfirmDialogProps {
  open: boolean;
  onClose?: () => void;
  onConfirm?: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
}
export declare function ConfirmDialog(props: ConfirmDialogProps): JSX.Element;
