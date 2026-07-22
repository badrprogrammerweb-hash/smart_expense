import type { ReactNode } from "react";

export function AppShell({ sidebar, header, children }: { sidebar: ReactNode; header: ReactNode; children: ReactNode }) { return <div className="min-h-screen bg-background lg:grid lg:grid-cols-[16rem_1fr]"><aside className="border-e bg-card">{sidebar}</aside><div className="min-w-0"><header className="border-b bg-card">{header}</header><main className="p-4 md:p-6">{children}</main></div></div>; }
