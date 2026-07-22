import type { ReactNode } from "react";

export function Chart({ title, summary, children }: { title: string; summary: string; children: ReactNode }) { return <section aria-labelledby="chart-title" className="rounded-[var(--radius-card)] border bg-card p-4"><h2 id="chart-title" className="font-semibold">{title}</h2><div className="mt-4">{children}</div><p className="mt-3 text-sm text-muted-foreground">{summary}</p></section>; }
