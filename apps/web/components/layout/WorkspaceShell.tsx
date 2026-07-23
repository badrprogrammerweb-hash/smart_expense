"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { WorkspaceSelector } from "@/components/layout/WorkspaceSelector";
import { IndeterminateOutcomeNotice, OfflineBanner, StaleDataNotice, useConnectivity } from "@/components/connectivity";
import { WorkspaceProvider, useWorkspaceContext } from "@/lib/workspace-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { canCreateExpense, canManageIncome, canUploadFile } from "@/lib/permissions";
import { AppShell, Button, MobileNavDrawer, Sidebar, TopHeader } from "@/components/ui";

const navItems: { key: string; href: string; roles: WorkspaceRole[] }[] = [
  { key: "dashboard", href: "dashboard", roles: ["owner", "admin", "member", "viewer"] },
  { key: "incomes", href: "incomes", roles: ["owner", "admin"] },
  { key: "expenses", href: "expenses", roles: ["owner", "admin", "member"] },
  { key: "files", href: "files", roles: ["owner", "admin", "member", "viewer"] },
  { key: "extractions", href: "extractions", roles: ["owner", "admin", "member", "viewer"] },
  { key: "categories", href: "categories", roles: ["owner", "admin", "member", "viewer"] },
  { key: "reports", href: "reports", roles: ["owner", "admin", "member", "viewer"] },
  { key: "history", href: "history", roles: ["owner", "admin"] },
  { key: "settings", href: "settings", roles: ["owner", "admin", "member", "viewer"] },
] as const;

export default function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <WorkspaceFrame>{children}</WorkspaceFrame>
    </WorkspaceProvider>
  );
}

function WorkspaceFrame({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("nav");
  const dashboardT = useTranslations("dashboard");
  const filesT = useTranslations("files");
  const { workspaceId, role } = useWorkspaceContext();
  const { canMutate } = useConnectivity();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    // Drop every cached query (including ["auth","currentUserId"]) so a
    // different account signing in on the same tab never reads stale data.
    queryClient.clear();
    router.replace(`/${locale}/sign-in`);
  }

  const navigation = (
    <Sidebar
      items={navItems
        .filter((item) => item.roles.includes(role))
        .map((item) => {
          const href = `/${locale}/w/${workspaceId}/${item.href}`;
          return { label: t(item.key), href, active: pathname === href };
        })}
    />
  );

  const quickActions = [
    canCreateExpense(role) && { href: `/${locale}/w/${workspaceId}/expenses`, label: dashboardT("addExpense"), icon: Plus },
    canManageIncome(role) && { href: `/${locale}/w/${workspaceId}/incomes`, label: dashboardT("addIncome"), icon: Plus },
    canUploadFile(role) && { href: `/${locale}/w/${workspaceId}/files`, label: filesT("upload.action"), icon: Upload },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Plus }[];

  const mobileNavigation = <div className="space-y-6">{navigation}<div className="border-t pt-4"><div className="grid gap-2">{quickActions.map((action) => { const Icon = action.icon; return <Link className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-secondary px-4 text-sm font-medium text-secondary-foreground no-underline hover:bg-[var(--color-surface-hover)]" href={action.href} key={action.href} onClick={() => setMobileNavigationOpen(false)}><Icon className="size-4" aria-hidden="true" />{action.label}</Link>; })}</div></div></div>;

  return <AppShell connectivity={<OfflineBanner />} staleNotice={<><IndeterminateOutcomeNotice /><StaleDataNotice /></>} sidebar={<div className="hidden lg:block">{navigation}</div>} header={<TopHeader title={t("workspaceRole", { role })} actions={<><Button className="lg:hidden" variant="ghost" size="icon" aria-label={t("openNavigation")} onClick={() => setMobileNavigationOpen(true)}><Menu className="size-4" /></Button><WorkspaceSelector /><Button variant="secondary" onClick={() => void signOut()}><LogOut className="size-4" aria-hidden="true" />{t("signOut")}</Button><MobileNavDrawer open={mobileNavigationOpen} onOpenChange={setMobileNavigationOpen} title={t("mobileNavigation")}>{mobileNavigation}</MobileNavDrawer></>} />}><div className="mx-auto max-w-7xl" aria-disabled={!canMutate}>{children}</div></AppShell>;
}
