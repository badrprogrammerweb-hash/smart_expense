import { BadgeCheck, Clock3, CircleX } from "lucide-react";

import { Badge } from "@/components/ui/badge";

const configs = { confirmed: { label: "Confirmed", variant: "income" as const, Icon: BadgeCheck }, pending: { label: "Pending review", variant: "pending" as const, Icon: Clock3 }, failed: { label: "Failed", variant: "expense" as const, Icon: CircleX }, neutral: { label: "Archived", variant: "neutral" as const, Icon: CircleX } };
export function StatusBadge({ status, label }: { status: keyof typeof configs; label?: string }) { const config = configs[status]; const Icon = config.Icon; return <Badge data-status={status} variant={config.variant}><Icon aria-hidden="true" className="size-3" />{label ?? config.label}</Badge>; }
