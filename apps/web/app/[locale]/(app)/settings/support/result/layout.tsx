import type { ReactNode } from "react";

import { createPageMetadata } from "@/lib/metadata/page-metadata";

export const generateMetadata = createPageMetadata("supportPurchases", "resultPageTitle");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
