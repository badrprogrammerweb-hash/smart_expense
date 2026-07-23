import type { ReactNode } from "react";

export function AppShell({ sidebar, header, connectivity, staleNotice, children }: { sidebar: ReactNode; header: ReactNode; connectivity?: ReactNode; staleNotice?: ReactNode; children: ReactNode }) { return <div className="min-h-screen bg-background lg:grid lg:grid-cols-[16rem_1fr]"><aside className="border-e bg-card">{sidebar}</aside><div className="min-w-0"><header className="border-b bg-card">{header}</header>{connectivity}<main className="p-4 md:p-6">{staleNotice}{children}</main></div></div>; }
