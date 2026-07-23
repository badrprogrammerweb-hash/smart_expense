"use client";

import { useCallback, useEffect, useState } from "react";

export type InstallCapability = "promptable" | "manual" | "installed" | "unsupported";

export type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallCapabilityState = {
  capability: InstallCapability;
  deferredPrompt: DeferredInstallPrompt | null;
  dismissedThisSession: boolean;
  dismiss: () => void;
  prompt: () => Promise<void>;
};

type SharedInstallState = Pick<InstallCapabilityState, "capability" | "deferredPrompt">;

declare global {
  interface Window {
    __smartExpenseInstallState?: SharedInstallState;
  }
}

const dismissalKey = "smart-expense.install-dismissed";
const installPromptSeenKey = "smart-expense.install-prompt-seen";
const listeners = new Set<(state: SharedInstallState) => void>();
let isListening = false;
let sharedState: SharedInstallState = { capability: "unsupported", deferredPrompt: null };

function snapshot() {
  if (typeof window !== "undefined" && window.__smartExpenseInstallState) {
    return window.__smartExpenseInstallState;
  }
  return sharedState;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  const displayMode = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const iosStandalone = "standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayMode || iosStandalone;
}

function supportsManualInstall() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent) || (/macintosh/.test(userAgent) && navigator.maxTouchPoints > 1);
  const isAlternativeIosBrowser = /crios|fxios|edgios|opios/.test(userAgent);
  return isIos && !isAlternativeIosBrowser;
}

function initialState(): SharedInstallState {
  if (isStandalone()) return { capability: "installed", deferredPrompt: null };
  if (wasInstallPromptSeenThisSession()) return { capability: "manual", deferredPrompt: null };
  if (supportsManualInstall()) return { capability: "manual", deferredPrompt: null };
  return { capability: "unsupported", deferredPrompt: null };
}

function publish(nextState: SharedInstallState) {
  sharedState = nextState;
  if (typeof window !== "undefined") window.__smartExpenseInstallState = nextState;
  listeners.forEach((listener) => listener(sharedState));
}

function ensureListeners() {
  if (isListening || typeof window === "undefined") return;
  isListening = true;
  publish(window.__smartExpenseInstallState ?? initialState());

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    try {
      window.sessionStorage.setItem(installPromptSeenKey, "true");
    } catch {
      // The deferred event remains usable for the current document when storage is unavailable.
    }
    publish({ capability: "promptable", deferredPrompt: event as DeferredInstallPrompt });
  });
  window.addEventListener("appinstalled", () => {
    publish({ capability: "installed", deferredPrompt: null });
  });
}

function wasDismissedThisSession() {
  try {
    return window.sessionStorage.getItem(dismissalKey) === "true";
  } catch {
    return false;
  }
}

function wasInstallPromptSeenThisSession() {
  try {
    return window.sessionStorage.getItem(installPromptSeenKey) === "true";
  } catch {
    return false;
  }
}

// Register as soon as this client module loads so an early platform event is not missed.
if (typeof window !== "undefined") ensureListeners();

export function useInstallCapability(): InstallCapabilityState {
  const [state, setState] = useState<SharedInstallState>(() => {
    ensureListeners();
    return snapshot();
  });
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  useEffect(() => {
    ensureListeners();
    setState(snapshot());
    setDismissedThisSession(wasDismissedThisSession());
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const dismiss = useCallback(() => {
    try {
      window.sessionStorage.setItem(dismissalKey, "true");
    } catch {
      // Session storage can be unavailable in private contexts; the in-memory state still suppresses the banner.
    }
    setDismissedThisSession(true);
  }, []);

  const prompt = useCallback(async () => {
    if (!state.deferredPrompt) return;
    await state.deferredPrompt.prompt();
    const choice = await state.deferredPrompt.userChoice;
    if (choice.outcome === "accepted") publish({ capability: "installed", deferredPrompt: null });
  }, [state.deferredPrompt]);

  return { ...state, dismissedThisSession, dismiss, prompt };
}
