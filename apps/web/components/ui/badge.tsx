import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2 py-1 text-xs font-medium", {
  variants: {
    variant: {
      neutral: "border-border bg-muted text-muted-foreground",
      income: "border-income-border bg-income-subtle text-income-foreground",
      expense: "border-expense-border bg-expense-subtle text-expense-foreground",
      pending: "border-pending-border bg-pending-subtle text-pending-foreground",
      info: "border-info-border bg-info-subtle text-info-foreground",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
