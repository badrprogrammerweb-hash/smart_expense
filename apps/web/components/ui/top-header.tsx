import type { ReactNode } from "react";
export function TopHeader({ title, actions }: { title: string; actions?: ReactNode }) { return <div className="flex min-h-14 items-center justify-between gap-4 px-4 md:px-6"><p className="font-semibold">{title}</p><div className="flex items-center gap-2">{actions}</div></div>; }
