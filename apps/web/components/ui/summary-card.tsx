import type { ReactNode } from "react";

export function SummaryCard({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return <section className="rounded-[var(--radius-card)] border border-primary/30 bg-card p-5 shadow-[var(--shadow-card)]"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>{detail ? <div className="mt-2 text-sm text-muted-foreground">{detail}</div> : null}</section>;
}
