"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let disposed = false;
    void navigator.serviceWorker.register("/sw.js").then((registration) => {
      if (disposed) return;
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          // skipWaiting in sw.js activates the new shell; later navigations use it.
          if (worker.state === "installed") void registration.update();
        });
      });
    }).catch(() => undefined);
    return () => { disposed = true; };
  }, []);
  return null;
}
