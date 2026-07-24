import type { HTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function FormField({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-2", className)} {...props} />;
}

export function FormLabel({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-sm font-medium", className)} {...props} />;
}

export function FormError({ children }: { children?: ReactNode }) {
  return children ? <p role="alert" className="flex items-center gap-1 text-sm text-expense-foreground">{children}</p> : null;
}

// Keeps the primary submit action reachable while the on-screen keyboard is
// open (contract K-1): sticks above the fixed bottom nav -- offset matches
// app-shell's `pb-24` -- rather than at true viewport bottom, where the nav
// would cover it. The nav is hidden at `lg`, so the footer reverts to normal
// static flow there (contract N-1's breakpoint).
export function FormFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky bottom-24 z-10 -mx-5 mt-2 flex flex-wrap items-center gap-2 border-t bg-card px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0",
        className,
      )}
      {...props}
    />
  );
}
