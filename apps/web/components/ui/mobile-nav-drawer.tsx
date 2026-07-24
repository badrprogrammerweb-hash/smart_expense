import type { ReactNode } from "react";

import { Dialog } from "@/components/ui/dialog";
export function MobileNavDrawer({ open, onOpenChange, onNavigate, title = "Navigation", children }: { open: boolean; onOpenChange: (open: boolean) => void; onNavigate: (href: string) => void; title?: string; children: ReactNode }) { return <Dialog open={open} onOpenChange={onOpenChange} onNavigate={onNavigate} title={title}><div className="pb-[env(safe-area-inset-bottom)]">{children}</div></Dialog>; }
