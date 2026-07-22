import { ShieldAlert } from "lucide-react";

// `title` and `description` are required, not defaulted: this primitive
// renders no `useTranslations` of its own, so a hardcoded English fallback
// here would silently show untranslated (or broken half-translated) text in
// the Arabic UI (FR-006) whenever a caller forgot to pass one.
export function PermissionDeniedState({ role, action, title, description }: { role: "Owner" | "Admin" | "Member" | "Viewer"; action: string; title: string; description: string }) {
  return <section data-testid="permission-denied-state" role="status" className="rounded-[var(--radius-card)] border border-pending-border bg-pending-subtle p-4 text-pending-foreground"><ShieldAlert aria-hidden="true" className="mb-2 size-5" /><h2 className="font-semibold">{title}</h2><p className="text-sm">{description}</p></section>;
}
