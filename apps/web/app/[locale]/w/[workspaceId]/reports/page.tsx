"use client";

import { useLocale } from "next-intl";

import { ReportSummary } from "@/components/reports/ReportSummary";
import { useWorkspaceContext } from "@/lib/workspace-context";

export default function ReportsPage() {
  const locale = useLocale();
  const { workspaceId } = useWorkspaceContext();

  return <ReportSummary locale={locale} workspaceId={workspaceId} />;
}
