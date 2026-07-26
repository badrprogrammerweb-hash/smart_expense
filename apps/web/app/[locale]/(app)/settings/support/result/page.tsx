import { Suspense } from "react";

import { SupportPurchaseResult } from "@/components/settings/SupportPurchaseResult";


export default function SupportPurchaseResultPage() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-2xl place-items-center px-4 py-8 sm:px-6">
      <Suspense fallback={<div className="h-48 w-full animate-pulse rounded-lg bg-muted" />}>
        <SupportPurchaseResult />
      </Suspense>
    </main>
  );
}
