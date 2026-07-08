"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getReport, type ReportPeriodInput } from "@/lib/api/reports";

export function useReports(workspaceId: string) {
  const [period, setPeriod] = useState<ReportPeriodInput>({ period: "current_month" });

  const queryKey = useMemo(() => ["reports", workspaceId, period], [workspaceId, period]);
  const query = useQuery({
    queryKey,
    queryFn: () => getReport(workspaceId, period),
    enabled: Boolean(workspaceId),
  });

  return {
    ...query,
    period,
    setPeriod,
  };
}
