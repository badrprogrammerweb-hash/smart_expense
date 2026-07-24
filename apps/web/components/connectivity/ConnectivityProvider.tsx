"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type ConnectivityStatus = "online" | "degraded" | "offline";

export type ConnectivityState = {
  status: ConnectivityStatus;
  canMutate: boolean;
  lastOnlineAt: Date | null;
};

const DEBOUNCE_MS = 1500;
const defaultConnectivity: ConnectivityState = { status: "online", canMutate: true, lastOnlineAt: null };
const ConnectivityContext = createContext<ConnectivityState>(defaultConnectivity);
const connectivityEvent = "smart-expense:connectivity";
const indeterminateEvent = "smart-expense:indeterminate-outcome";

function publish(outcome: "failure" | "success") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(connectivityEvent, { detail: outcome }));
  }
}

export function reportConnectivityFailure() {
  publish("failure");
}

export function reportConnectivitySuccess() {
  publish("success");
}

export function reportIndeterminateOutcome() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(indeterminateEvent));
}

function apiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
}

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConnectivityState>({
    status: typeof navigator === "undefined" || navigator.onLine ? "online" : "offline",
    canMutate: typeof navigator === "undefined" || navigator.onLine,
    lastOnlineAt: typeof navigator === "undefined" || navigator.onLine ? new Date() : null,
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function schedule(next: ConnectivityStatus, probeRecovery = false) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(async () => {
        if (probeRecovery && navigator.onLine) {
          try {
            const response = await fetch(`${apiBaseUrl()}/health`, { method: "GET", credentials: "omit" });
            if (!response.ok) {
              setState((current) => ({ ...current, status: "degraded", canMutate: false }));
              return;
            }
          } catch {
            setState((current) => ({ ...current, status: "degraded", canMutate: false }));
            return;
          }
        }

        setState((current) => ({ status: next, canMutate: next === "online", lastOnlineAt: next === "online" ? new Date() : current.lastOnlineAt }));
      }, DEBOUNCE_MS);
    }

    function onOffline() {
      schedule("offline");
    }

    function onOnline() {
      schedule("online", true);
    }

    function onOutcome(event: Event) {
      const outcome = (event as CustomEvent<"failure" | "success">).detail;
      if (outcome === "failure") {
        schedule(navigator.onLine ? "degraded" : "offline");
      } else if (navigator.onLine) {
        schedule("online");
      }
    }

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    window.addEventListener(connectivityEvent, onOutcome);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.removeEventListener(connectivityEvent, onOutcome);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity() {
  return useContext(ConnectivityContext);
}

export function useIndeterminateOutcome() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = () => setVisible(true);
    // A prior interrupted mutation's outcome stops being "unknown" once a
    // request succeeds again — by then reconnect has refetched the affected
    // list (D-3), so continuing to show "outcome unknown" would be stale and
    // misleading rather than informative. Without this, a single connectivity
    // hiccup anywhere in the session would leave the notice visible forever.
    const clearOnRecovery = (event: Event) => {
      if ((event as CustomEvent<"failure" | "success">).detail === "success") setVisible(false);
    };
    window.addEventListener(indeterminateEvent, show);
    window.addEventListener(connectivityEvent, clearOnRecovery);
    return () => {
      window.removeEventListener(indeterminateEvent, show);
      window.removeEventListener(connectivityEvent, clearOnRecovery);
    };
  }, []);
  return visible;
}
