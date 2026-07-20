import React from 'react';
/**
 * @startingPoint section="Components" subtitle="Pill status chip — AI states, record status, roles" viewport="500x100"
 */
export interface BadgeProps {
  children?: React.ReactNode;
  tone?: 'neutral' | 'primary' | 'income' | 'expense' | 'warning' | 'info';
  dot?: boolean;
}
export declare function Badge(props: BadgeProps): JSX.Element;
