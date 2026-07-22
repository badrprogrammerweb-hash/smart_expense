import { CirclePlus } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: { label: string; onClick: () => void } }) {
  return <section className="grid min-h-48 place-items-center rounded-[var(--radius-card)] border border-dashed p-6 text-center"><div className="space-y-2"><CirclePlus aria-hidden="true" className="mx-auto size-6 text-primary" /><h2 className="font-semibold">{title}</h2>{description ? <p className="text-sm text-muted-foreground">{description}</p> : null}{action ? <Button onClick={action.onClick}>{action.label}</Button> : null}</div></section>;
}
