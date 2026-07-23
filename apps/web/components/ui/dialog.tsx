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

  // A device back gesture must close the dialog rather than navigate the
  // underlying screen away (contract T-3). Pushing a history entry while open
  // means the gesture fires `popstate` here instead of leaving the page; a
  // dialog closed any other way (Escape, backdrop, close button) pops that
  // entry itself so a real back-navigation right after isn't swallowed by it.
  useEffect(() => {
    if (!open) return;
    let closedByPopState = false;
    window.history.pushState({ smartExpenseDialogOpen: true }, "");
    function onPopState() {
      closedByPopState = true;
      onOpenChange(false);
    }
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (!closedByPopState) window.history.back();
    };
  }, [open, onOpenChange]);

  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]" role="presentation"><button aria-label="Close dialog" className="absolute inset-0 cursor-default bg-foreground/30" onClick={() => onOpenChange(false)} /><div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative z-10 flex max-h-[85dvh] w-full max-w-lg flex-col rounded-[var(--radius-card)] border bg-card p-6 shadow-[var(--shadow-dialog)] outline-none"><div className="flex items-start justify-between gap-4"><h2 id={titleId} className="text-lg font-semibold">{title}</h2><IconButton label="Close dialog" variant="ghost" onClick={() => onOpenChange(false)}><X className="size-4" /></IconButton></div><div className="mt-4 overflow-y-auto">{children}</div>{footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}</div></div>;
}
