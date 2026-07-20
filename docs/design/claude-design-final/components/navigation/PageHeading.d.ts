import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Title + description + right-aligned actions" viewport="700x90"
 */
export interface PageHeadingProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  dir?: 'rtl' | 'ltr';
}
export declare function PageHeading(props: PageHeadingProps): JSX.Element;
