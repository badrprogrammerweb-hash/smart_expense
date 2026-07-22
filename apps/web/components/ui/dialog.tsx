import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { IconButton } from "@/components/ui/icon-button";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function Dialog({ open, onOpenChange, title, children, footer }: DialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
        if (!focusable?.length) { event.preventDefault(); return; }
        const items = Array.from(focusable);
        const first = items[0]; const last = items.at(-1)!;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [onOpenChange, open]);

  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]" role="presentation"><button aria-label="Close dialog" className="absolute inset-0 cursor-default bg-foreground/30" onClick={() => onOpenChange(false)} /><div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative z-10 w-full max-w-lg rounded-[var(--radius-card)] border bg-card p-6 shadow-[var(--shadow-dialog)] outline-none"><div className="flex items-start justify-between gap-4"><h2 id={titleId} className="text-lg font-semibold">{title}</h2><IconButton label="Close dialog" variant="ghost" onClick={() => onOpenChange(false)}><X className="size-4" /></IconButton></div><div className="mt-4">{children}</div>{footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}</div></div>;
}
