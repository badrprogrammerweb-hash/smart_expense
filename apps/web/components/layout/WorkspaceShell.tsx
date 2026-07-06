"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { WorkspaceSelector } from "@/components/layout/WorkspaceSelector";
import { WorkspaceProvider, useWorkspaceContext } from "@/lib/workspace-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { WorkspaceRole } from "@/lib/api/workspaces";

const navItems: { key: string; href: string; roles: WorkspaceRole[] }[] = [
  { key: "dashboard", href: "dashboard", roles: ["owner", "admin", "member", "viewer"] },
  { key: "incomes", href: "incomes", roles: ["owner", "admin"] },
  { key: "expenses", href: "expenses", roles: ["owner", "admin", "member"] },
  { key: "files", href: "files", roles: ["owner", "admin", "member", "viewer"] },
  { key: "extractions", href: "extractions", roles: ["owner", "admin", "member", "viewer"] },
  { key: "categories", href: "categories", roles: ["owner", "admin", "member", "viewer"] },
  { key: "reports", href: "reports", roles: ["owner", "admin", "member", "viewer"] },
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
  const { workspaceId, role } = useWorkspaceContext();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    // Drop every cached query (including ["auth","currentUserId"]) so a
    // different account signing in on the same tab never reads stale data.
    queryClient.clear();
    router.replace(`/${locale}/sign-in`);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <WorkspaceSelector />
              <p className="mt-2 text-sm text-muted-foreground">{t("workspaceRole", { role })}</p>
            </div>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted"
              type="button"
              onClick={() => void signOut()}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {t("signOut")}
            </button>
          </div>
          <nav className="flex gap-2 overflow-x-auto">
            {navItems
              .filter((item) => item.roles.includes(role))
              .map((item) => {
                const href = `/${locale}/w/${workspaceId}/${item.href}`;
                const active = pathname === href;

                return (
                  <Link
                    className={cn(
                      "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground no-underline hover:bg-muted hover:text-foreground",
                      active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    )}
                    href={href}
                    key={item.key}
                  >
                    {t(item.key)}
                  </Link>
                );
              })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
