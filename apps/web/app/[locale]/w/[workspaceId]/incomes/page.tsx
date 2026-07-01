"use client";

import { IncomeForm } from "@/components/income/IncomeForm";
import { IncomeHistoryList } from "@/components/income/IncomeHistoryList";
import { useWorkspaceContext } from "@/lib/workspace-context";

export default function IncomesPage() {
  const { workspaceId, role } = useWorkspaceContext();

  return (
    <div className="space-y-6">
      <IncomeForm workspaceId={workspaceId} role={role} />
      <IncomeHistoryList workspaceId={workspaceId} role={role} />
    </div>
  );
}
