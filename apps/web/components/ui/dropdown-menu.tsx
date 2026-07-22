import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

export type DropdownMenuItem = { label: string; onSelect: () => void; disabled?: boolean };

export function DropdownMenu({ label, items, children }: { label: string; items: DropdownMenuItem[]; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { function onOutside(event: MouseEvent) { if (!containerRef.current?.contains(event.target as Node)) setOpen(false); } document.addEventListener("mousedown", onOutside); return () => document.removeEventListener("mousedown", onOutside); }, []);
  return <div ref={containerRef} className="relative inline-block"><Button variant="ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{children ?? label}</Button>{open ? <div role="menu" className="absolute end-0 z-20 mt-2 min-w-40 rounded-[var(--radius-control)] border bg-card p-1 shadow-[var(--shadow-card)]">{items.map((item) => <button key={item.label} role="menuitem" disabled={item.disabled} className="flex min-h-11 w-full items-center rounded-[var(--radius-control)] px-3 text-start text-sm hover:bg-[var(--color-surface-hover)] disabled:opacity-50" onClick={() => { item.onSelect(); setOpen(false); }}>{item.label}</button>)}</div> : null}</div>;
}
