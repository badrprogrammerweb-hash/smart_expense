import type { ReactNode } from "react";

export function InfoCard({ title, value, children }: { title: string; value?: ReactNode; children?: ReactNode }) {
  return <section className="rounded-[var(--radius-card)] border bg-card p-4 shadow-[var(--shadow-card)]"><h2 className="text-sm font-medium text-muted-foreground">{title}</h2>{value ? <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p> : null}{children ? <div className="mt-3">{children}</div> : null}</section>;
}
