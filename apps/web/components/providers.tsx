"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";

import { ConnectivityProvider, reportConnectivityFailure, reportConnectivitySuccess, reportIndeterminateOutcome } from "@/components/connectivity";
import { isConnectivityError } from "@/lib/api/client";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (isConnectivityError(error)) reportConnectivityFailure();
          },
          onSuccess: () => reportConnectivitySuccess(),
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            if (isConnectivityError(error)) {
              reportConnectivityFailure();
              reportIndeterminateOutcome();
            }
          },
          onSuccess: () => reportConnectivitySuccess(),
        }),
        defaultOptions: {
          queries: {
            // Keep focus refetching: it is bounded by React Query's stale policy and
            // complements the built-in reconnect refetch without any polling loop.
            refetchOnWindowFocus: true,
            retry: 1,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return <ConnectivityProvider><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></ConnectivityProvider>;
}
