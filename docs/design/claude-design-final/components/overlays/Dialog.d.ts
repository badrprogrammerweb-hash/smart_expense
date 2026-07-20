import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Scrim + centered panel, Esc + overlay to close" viewport="480x360"
 */
export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Preset width, or an exact px number (e.g. 540) for a custom centered width */
  size?: 'sm' | 'md' | 'lg' | number;
  dir?: 'rtl' | 'ltr';
  /** On mobile (<768px) becomes a full-width bottom sheet with fixed header/footer and a scrolling body, matching CategoryPickerDialog */
  mobileFullSheet?: boolean;
}
export declare function Dialog(props: DialogProps): JSX.Element;
