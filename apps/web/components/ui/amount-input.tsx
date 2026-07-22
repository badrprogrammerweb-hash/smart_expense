import { forwardRef, type InputHTMLAttributes } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type AmountInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode"> & {
  currency: string;
  sign?: "+" | "-";
  error?: boolean;
};

export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  { currency, sign, className, error, ...props },
  ref,
) {
  return (
    <div dir="ltr" className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-input bg-card px-3 focus-within:shadow-[var(--shadow-focus)]">
      {sign ? <span aria-hidden="true" className="font-semibold">{sign}</span> : null}
      <Input ref={ref} className={cn("min-h-0 border-0 p-0 shadow-none focus-visible:shadow-none", className)} error={error} inputMode="decimal" type="text" {...props} />
      <span className="text-sm text-muted-foreground">{currency}</span>
    </div>
  );
});
