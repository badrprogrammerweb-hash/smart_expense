import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
export type SidebarItem = { label: string; href: string; icon?: ReactNode; active?: boolean };
export function Sidebar({ items }: { items: SidebarItem[] }) { return <nav aria-label="Workspace navigation" className="space-y-1 p-3">{items.map((item) => <a key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm hover:bg-[var(--color-surface-hover)]", item.active && "bg-primary text-primary-foreground hover:bg-[var(--color-primary-hover)]")}>{item.icon}{item.label}</a>)}</nav>; }
