import { cn } from "@/lib/utils";

export function Skeleton({ className, label = "Loading content" }: { className?: string; label?: string }) {
  return <div role="status" aria-label={label} className={cn("animate-pulse rounded-[var(--radius-control)] bg-muted", className)}><span className="sr-only">{label}</span></div>;
}
