import { act, renderHook } from "@testing-library/react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectivityProvider, reportConnectivityFailure, reportConnectivitySuccess, reportIndeterminateOutcome, useConnectivity, useIndeterminateOutcome } from "@/components/connectivity/ConnectivityProvider";
import { ApiError, ConnectivityError } from "@/lib/api/client";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(ConnectivityProvider, null, children);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// `reportConnectivityFailure`/`reportConnectivitySuccess` only ever publish the
// literal strings "failure"/"success" — the real ApiError-vs-ConnectivityError
// classification lives in AppProviders' QueryCache.onError (the `isConnectivityError`
// gate before calling reportConnectivityFailure). These two must exercise that real
// wiring via an actual failing query, not dispatch a synthetic browser event: dispatching
// any detail other than the literal string "failure" would pass regardless of whether
// the classifier is wired up correctly at all.
function providersUnderTestWith(onError: (error: unknown) => void) {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    defaultOptions: { queries: { retry: false } },
  });
  function ProvidersUnderTest({ children }: { children: ReactNode }) {
    return createElement(ConnectivityProvider, null, createElement(QueryClientProvider, { client: queryClient }, children));
  }
  return { queryClient, ProvidersUnderTest };
}

describe("connectivity state machine", () => {
  it("does not classify a real ApiError from a failing query as a connectivity failure", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const { queryClient, ProvidersUnderTest } = providersUnderTestWith((error) => {
      if (error instanceof ConnectivityError) reportConnectivityFailure();
    });
    const { result } = renderHook(() => useConnectivity(), { wrapper: ProvidersUnderTest });

    await act(async () => {
      await queryClient
        .fetchQuery({
          queryKey: ["boom"],
          queryFn: () => {
            throw new ApiError(422, "validation_failed", "backend answered with a validation error");
          },
        })
        .catch(() => undefined);
    });

    expect(result.current.status).toBe("online");
  });

  it("classifies a real ConnectivityError from a failing query as a connectivity failure", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const { queryClient, ProvidersUnderTest } = providersUnderTestWith((error) => {
      if (error instanceof ConnectivityError) reportConnectivityFailure();
    });
    const { result } = renderHook(() => useConnectivity(), { wrapper: ProvidersUnderTest });

    await act(async () => {
      await queryClient
        .fetchQuery({
          queryKey: ["unreachable"],
          queryFn: () => {
            throw new ConnectivityError("network request failed");
          },
        })
        .catch(() => undefined);
    });
    await act(async () => vi.advanceTimersByTimeAsync(1500));

    expect(result.current.status).toBe("degraded");
  });

  it("debounces offline and online recovery without polling", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useConnectivity(), { wrapper });
    act(() => reportConnectivityFailure());
    expect(result.current.status).toBe("online");
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(result.current.status).toBe("degraded");
    act(() => reportConnectivitySuccess());
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(result.current.status).toBe("online");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // D-3 requires the affected list to be refetched before the user is offered a
  // retry; leaving "outcome unknown" visible after that refetch has already
  // succeeded would be stale and misleading, not merely unnecessary.
  it("clears the indeterminate-outcome notice once a request succeeds again, rather than persisting for the rest of the session", () => {
    const { result } = renderHook(() => useIndeterminateOutcome(), { wrapper });
    expect(result.current).toBe(false);

    act(() => reportIndeterminateOutcome());
    expect(result.current).toBe(true);

    act(() => reportConnectivitySuccess());
    expect(result.current).toBe(false);
  });
});
