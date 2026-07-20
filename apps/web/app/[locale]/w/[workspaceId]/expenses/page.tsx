"use client";

import { ExpenseForm } from "@/components/expense/ExpenseForm";
import { ExpenseHistoryList } from "@/components/expense/ExpenseHistoryList";
import { useWorkspaceContext } from "@/lib/workspace-context";

export default function ExpensesPage() {
  const { workspaceId, role, currency } = useWorkspaceContext();

  return (
    <div className="space-y-6">
      <ExpenseForm workspaceId={workspaceId} role={role} currency={currency} />
      <ExpenseHistoryList workspaceId={workspaceId} role={role} />
    </div>
  );
}
