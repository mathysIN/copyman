// @ts-nocheck

const CACHE_VERSION = "v6";
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;
const OFFLINE_URL = "/";
const LAST_NAV_KEY = "/__last_navigation__";

const SHELL_ASSETS = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![SHELL_CACHE, RUNTIME_CACHE].includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request, { cache: "reload" });
          const cache = await caches.open(RUNTIME_CACHE);
          event.waitUntil(
            Promise.all([
              cache.put(request, response.clone()),
              cache.put(LAST_NAV_KEY, response.clone()),
            ]),
          );
          return response;
        } catch (_) {
          const exact = await caches.match(request);
          if (exact) return exact;
          const last = await caches.match(LAST_NAV_KEY);
          if (last) return last;
          const home = await caches.match(OFFLINE_URL);
          return home || new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
