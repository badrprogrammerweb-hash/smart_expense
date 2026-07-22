import type { ReactNode } from "react";

export type RecordField = { label: string; value: ReactNode };

export function MobileRecordCard({ title, fields, actions }: { title: ReactNode; fields: RecordField[]; actions?: ReactNode }) {
  return <article data-testid="mobile-record-card" className="space-y-3 rounded-[var(--radius-card)] border bg-card p-4 shadow-[var(--shadow-card)]"><div className="font-medium">{title}</div><dl className="grid grid-cols-2 gap-3 text-sm">{fields.map((field) => <div key={field.label}><dt className="text-muted-foreground">{field.label}</dt><dd>{field.value}</dd></div>)}</dl>{actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}</article>;
}
