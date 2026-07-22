import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 py-2 text-sm font-medium transition duration-150 focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] active:scale-[.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-[var(--color-primary-hover)]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-[var(--color-surface-hover)]",
        destructive: "bg-expense text-white hover:bg-expense-foreground",
        ghost: "bg-transparent text-foreground hover:bg-[var(--color-surface-hover)]",
      },
      size: { default: "min-w-24", compact: "min-w-20 px-3", icon: "w-11 px-0" },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { loading?: boolean; loadingLabel?: string };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading = false, loadingLabel, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), "relative", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <LoaderCircle
          aria-hidden="true"
          className="absolute size-4 animate-spin"
        />
      ) : null}
      {/* The spinner overlays the label (rather than joining it as a flex
          sibling), and the label stays in flow at full width but visually
          transparent while loading, so the button's own box never changes
          width (FR-016). `opacity-0` (not `invisible`/visibility:hidden) is
          used deliberately: visibility:hidden removes text from the
          accessible name computation, which would leave the button
          unlabelled to screen readers while busy. */}
      <span className={cn(loading && "opacity-0")}>{loading ? (loadingLabel ?? children) : children}</span>
    </button>
  );
});

export { buttonVariants };
