import type { ReactNode } from "react";

type DataStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: DataStateProps) {
  return (
    <section className="rounded-lg border border-dashed bg-card p-6 text-center text-card-foreground">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}

export function ErrorState({ title, description, action }: DataStateProps) {
  return (
    <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
      <h2 className="text-lg font-semibold text-destructive">{title}</h2>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}
