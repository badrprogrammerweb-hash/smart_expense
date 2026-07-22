import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, error, children, ...props }, ref) {
  return <select ref={ref} className={cn("min-h-11 w-full rounded-[var(--radius-control)] border bg-card px-3 py-2 text-sm outline-none focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-50", error ? "border-expense" : "border-input", className)} aria-invalid={error || undefined} {...props}>{children}</select>;
});
