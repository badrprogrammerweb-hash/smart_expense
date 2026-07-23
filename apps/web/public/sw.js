const CACHE_VERSION = "smart-expense-shell-v1";
const SHELL_PATHS = ["/en/offline", "/ar/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-512-maskable.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_PATHS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

function isCacheableShellRequest(request, url) {
  if (request.method !== "GET" || request.headers.has("Authorization") || url.origin !== self.location.origin) return false;
  return request.mode === "navigate" || url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest";
}

function mayStore(response) {
  return response.ok && !response.headers.has("Set-Cookie") && !/no-store/i.test(response.headers.get("Cache-Control") || "");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (!isCacheableShellRequest(request, url)) return;

  if (request.mode === "navigate") {
    // Navigation documents are NEVER written to the cache here, even opportunistically.
    // Only the two offline routes are ever stored, and only via the unconditional
    // `cache.addAll` in the install handler above. Every other route is dynamic and
    // workspace-scoped; persisting it would violate the "nothing else" cache contract
    // and must not depend on Next.js's current no-store defaults for dynamic routes.
    event.respondWith(
      fetch(request).catch(
        async () => (await caches.match(request)) || caches.match(url.pathname.startsWith("/ar/") ? "/ar/offline" : "/en/offline"),
      ),
    );
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (mayStore(response)) caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});
