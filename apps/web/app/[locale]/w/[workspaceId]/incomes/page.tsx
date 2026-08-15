"use client";

import { useTranslations } from "next-intl";

import { IncomeForm } from "@/components/income/IncomeForm";
import { IncomeHistoryList } from "@/components/income/IncomeHistoryList";
import { useWorkspaceContext } from "@/lib/workspace-context";
import { PageHeading } from "@/components/ui";

export default function IncomesPage() {
  const t = useTranslations("nav");
  const { workspaceId, role, currency } = useWorkspaceContext();

  return (
    <div className="space-y-6">
      <PageHeading title={t("incomes")} />
      <IncomeForm workspaceId={workspaceId} role={role} currency={currency} />
      <IncomeHistoryList workspaceId={workspaceId} role={role} />
    </div>
  );
}
