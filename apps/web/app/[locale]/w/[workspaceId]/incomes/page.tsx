"use client";

import { IncomeForm } from "@/components/income/IncomeForm";
import { IncomeHistoryList } from "@/components/income/IncomeHistoryList";
import { useWorkspaceContext } from "@/lib/workspace-context";

export default function IncomesPage() {
  const { workspaceId, role, currency } = useWorkspaceContext();

  return (
    <div className="space-y-6">
      <IncomeForm workspaceId={workspaceId} role={role} currency={currency} />
      <IncomeHistoryList workspaceId={workspaceId} role={role} />
    </div>
  );
}
