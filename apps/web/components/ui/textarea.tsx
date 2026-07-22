import { forwardRef, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, error, ...props }, ref) {
  return <textarea ref={ref} className={cn("min-h-24 w-full rounded-[var(--radius-control)] border bg-card px-3 py-2 text-sm outline-none focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-50", error ? "border-expense" : "border-input", className)} aria-invalid={error || undefined} {...props} />;
});
