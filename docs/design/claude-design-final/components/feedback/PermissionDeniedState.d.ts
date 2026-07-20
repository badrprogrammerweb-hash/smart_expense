import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Explains a role restriction, never a bare access-denied" viewport="440x240"
 */
export interface PermissionDeniedStateProps {
  title?: string;
  description?: string;
  roleRequired?: string;
}
export declare function PermissionDeniedState(props: PermissionDeniedStateProps): JSX.Element;
