import type { ReactNode } from "react";

export function FilterBar({ children }: { children: ReactNode }) {
  return <div role="group" aria-label="Filters" className="flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] border bg-card p-3">{children}</div>;
}
