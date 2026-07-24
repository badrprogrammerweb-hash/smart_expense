import type { ReactNode } from "react";

import WorkspaceShell from "@/components/layout/WorkspaceShell";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

// The locally bundled Capacitor shell is client-rendered. A single static
// route seeds Next's export; the real workspace id remains runtime data from
// the authoritative backend and is never baked into the package.
export function generateStaticParams() {
  return process.env.CAPACITOR_BUILD === "1" ? [{ workspaceId: "native" }] : [];
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <WorkspaceShell><InstallPrompt />{children}</WorkspaceShell>;
}
