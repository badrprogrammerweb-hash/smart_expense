import { X } from "lucide-react";
import type { ReactNode } from "react";

import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

export function Toast({ title, children, onDismiss, variant = "info" }: { title: string; children?: ReactNode; onDismiss?: () => void; variant?: "info" | "success" | "error" }) {
  const style = variant === "error" ? "border-expense-border" : variant === "success" ? "border-income-border" : "border-info-border";
  return (
    <div role="status" className={cn("flex min-w-72 items-start gap-3 rounded-[var(--radius-card)] border bg-card p-3 shadow-[var(--shadow-card)]", style)}>
      <div className="flex-1"><p className="font-medium">{title}</p>{children}</div>
      {onDismiss ? <IconButton label="Dismiss notification" variant="ghost" onClick={onDismiss}><X className="size-4" /></IconButton> : null}
    </div>
  );
}
