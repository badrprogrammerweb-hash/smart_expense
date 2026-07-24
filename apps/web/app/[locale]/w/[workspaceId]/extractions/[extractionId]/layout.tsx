import type { ReactNode } from "react";

export function generateStaticParams() {
  return process.env.CAPACITOR_BUILD === "1" ? [{ extractionId: "native" }] : [];
}

export default function ExtractionLayout({ children }: { children: ReactNode }) {
  return children;
}
