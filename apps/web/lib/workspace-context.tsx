"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams, usePathname, useRouter } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useCurrentUserId } from "@/hooks/use-current-user";
import { useWorkspace } from "@/hooks/use-workspaces";
import { ApiError } from "@/lib/api/client";
import type { WorkspaceRole, WorkspaceType } from "@/lib/api/workspaces";
import type { SupportedCurrency } from "@/lib/currency";

const LAST_WORKSPACE_KEY = "smart-expense.lastWorkspaceId";

export type WorkspaceContextValue = {
  workspaceId: string;
  workspaceType: WorkspaceType;
  workspaceName: string;
  role: WorkspaceRole;
  currency: SupportedCurrency;
  currencyLocked: boolean;
  memberCount: number;
  autoDeleteAfterExtraction: boolean;
  currentUserId: string | null;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ workspaceId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("common");
  const errorT = useTranslations("errors");
  const workspaceId = params.workspaceId;
  const workspaceQuery = useWorkspace(workspaceId);
  const currentUserQuery = useCurrentUserId();

  // Screens under this layout never remount across dashboard/incomes/expenses
  // navigation, so `useWorkspace`'s own query never refires on its own. Refetch
  // role on every workspace-scoped navigation (not just window refocus) so a
  // permission change made elsewhere is picked up before the next protected
  // action, per FR-035/FR-037.
  const refetchWorkspaceRef = useRef(workspaceQuery.refetch);
  refetchWorkspaceRef.current = workspaceQuery.refetch;
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      void refetchWorkspaceRef.current();
    }
  }, [pathname]);

  // Switching to a workspace TanStack Query already has cached from earlier
  // in the session renders that (possibly-stale) cache immediately — data
  // existing means `isLoading` is false — while refetching in the
  // background. That could briefly show a role that's no longer current
  // (FR-035/FR-037). Adjusted during render, not in an effect, so the
  // stale value is never painted (React's documented "adjusting state
  // when a prop changes" pattern) — the loading gate below stays active
  // until the newly-selected workspace's own fetch actually settles.
  const [renderedWorkspaceId, setRenderedWorkspaceId] = useState(workspaceId);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);

  if (workspaceId !== renderedWorkspaceId) {
    setRenderedWorkspaceId(workspaceId);
    setIsSwitchingWorkspace(true);
  }

  useEffect(() => {
    if (isSwitchingWorkspace && !workspaceQuery.isFetching) {
      setIsSwitchingWorkspace(false);
    }
  }, [isSwitchingWorkspace, workspaceQuery.isFetching]);

  useEffect(() => {
    if (workspaceQuery.data?.id) {
      window.localStorage.setItem(LAST_WORKSPACE_KEY, workspaceQuery.data.id);
    }
  }, [workspaceQuery.data?.id]);

  useEffect(() => {
    if (workspaceQuery.error instanceof ApiError && workspaceQuery.error.status === 404) {
      router.replace(`/${locale}`);
    }
  }, [locale, router, workspaceQuery.error]);

  const value = useMemo<WorkspaceContextValue | null>(() => {
    if (!workspaceQuery.data) {
      return null;
    }

    return {
      workspaceId: workspaceQuery.data.id,
      workspaceType: workspaceQuery.data.type,
      workspaceName: workspaceQuery.data.name,
      role: workspaceQuery.data.role,
      currency: workspaceQuery.data.currency,
      currencyLocked: workspaceQuery.data.currency_locked,
      memberCount: workspaceQuery.data.member_count,
      autoDeleteAfterExtraction: workspaceQuery.data.auto_delete_after_extraction,
      currentUserId: currentUserQuery.data ?? null,
    };
  }, [workspaceQuery.data, currentUserQuery.data]);

  if (workspaceQuery.isLoading || currentUserQuery.isLoading || isSwitchingWorkspace) {
    return <main className="p-6 text-sm text-muted-foreground">{t("loading")}</main>;
  }

  if (workspaceQuery.isError || !value) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <section className="max-w-md rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <h1 className="text-lg font-semibold">{errorT("requestFailed")}</h1>
          <button
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            type="button"
            onClick={() => void workspaceQuery.refetch()}
          >
            {t("retry")}
          </button>
        </section>
      </main>
    );
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext() {
  const value = useContext(WorkspaceContext);

  if (!value) {
    throw new Error("useWorkspaceContext must be used inside WorkspaceProvider.");
  }

  return value;
}

export function readLastWorkspaceId() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(LAST_WORKSPACE_KEY);
}

export function writeLastWorkspaceId(workspaceId: string) {
  window.localStorage.setItem(LAST_WORKSPACE_KEY, workspaceId);
}
