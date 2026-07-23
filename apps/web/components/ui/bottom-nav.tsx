import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export type BottomNavItem = { href: string; label: string; icon: LucideIcon; active: boolean };

export function BottomNav({ items, moreLabel, navLabel, onMore }: { items: BottomNavItem[]; moreLabel: string; navLabel: string; onMore: () => void }) {
  return <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card safe-area-block-end safe-area-x lg:hidden" aria-label={navLabel}>{items.slice(0, 4).map(({ href, label, icon: Icon, active }) => <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs no-underline focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] ${active ? "text-primary" : "text-muted-foreground"}`}><Icon className="size-5" aria-hidden="true" />{label}</Link>)}<button type="button" onClick={onMore} className="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs text-muted-foreground focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"><span aria-hidden="true">•••</span>{moreLabel}</button></nav>;
}
