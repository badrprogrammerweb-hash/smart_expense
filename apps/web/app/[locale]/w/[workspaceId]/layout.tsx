import type { ReactNode } from "react";

import WorkspaceShell from "@/components/layout/WorkspaceShell";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <WorkspaceShell><InstallPrompt />{children}</WorkspaceShell>;
}
