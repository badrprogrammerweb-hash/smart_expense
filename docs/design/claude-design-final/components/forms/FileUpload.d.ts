import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Receipt/invoice drop zone with progress" viewport="360x180"
 */
export interface FileUploadProps {
  label?: string;
  fileName?: string;
  progress?: number;
  status?: 'idle' | 'uploading' | 'done' | 'error';
  onPick?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hint?: string;
}
export declare function FileUpload(props: FileUploadProps): JSX.Element;
