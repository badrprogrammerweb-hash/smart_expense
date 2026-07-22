import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  children?: ReactNode;
  variant?: "info" | "success" | "error";
};

const icons = { info: Info, success: CircleCheck, error: CircleAlert };
const styles = {
  info: "border-info-border bg-info-subtle text-info-foreground",
  success: "border-income-border bg-income-subtle text-income-foreground",
  error: "border-expense-border bg-expense-subtle text-expense-foreground",
};

export function Alert({ title, children, variant = "info", className, ...props }: AlertProps) {
  const Icon = icons[variant];
  return (
    <div role="alert" className={cn("flex gap-3 rounded-[var(--radius-control)] border p-3", styles[variant], className)} {...props}>
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="space-y-1"><p className="font-medium">{title}</p>{children}</div>
    </div>
  );
}
