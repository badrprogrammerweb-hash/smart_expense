import type { ReactNode } from "react";

import { createPageMetadata } from "@/lib/metadata/page-metadata";

export const generateMetadata = createPageMetadata("auth", "signUpTitle");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
