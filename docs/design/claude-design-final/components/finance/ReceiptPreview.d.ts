import React from 'react';
/**
 * @startingPoint section="Components" subtitle="True-to-source receipt image, never stylized" viewport="320x300"
 */
export interface ReceiptPreviewProps {
  src?: string;
  fileName?: string;
  onZoom?: () => void;
}
export declare function ReceiptPreview(props: ReceiptPreviewProps): JSX.Element;
