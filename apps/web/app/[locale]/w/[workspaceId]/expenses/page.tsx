"use client";

import { useTranslations } from "next-intl";

import { ExpenseForm } from "@/components/expense/ExpenseForm";
import { ExpenseHistoryList } from "@/components/expense/ExpenseHistoryList";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { PageHeading } from "@/components/ui";

export default function ExpensesPage() {
  const t = useTranslations("nav");
  const { workspaceId, role, currency } = useWorkspaceContext();

  return (
    <div className="space-y-6">
      <PageHeading title={t("expenses")} />
      <ExpenseForm workspaceId={workspaceId} role={role} currency={currency} />
      <ExpenseHistoryList workspaceId={workspaceId} role={role} />
    </div>
  );
}
