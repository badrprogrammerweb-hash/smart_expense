import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & { error?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, error, ...props }, ref) {
  return <input ref={ref} className={cn("min-h-11 w-full rounded-[var(--radius-control)] border bg-card px-3 py-2 text-sm outline-none transition focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-50", error ? "border-expense" : "border-input", className)} aria-invalid={error || undefined} {...props} />;
});
