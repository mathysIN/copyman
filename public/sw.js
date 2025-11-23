// @ts-nocheck

const CACHE_VERSION = "v10";
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const OFFLINE_URL = "/";
const LAST_NAV_KEY = "/__last_navigation__";

const SHELL_ASSETS = ["/"];
const STATIC_ASSETS = [
  "/favicon.ico",
  "/favicon.png",
  "/logo.png",
  "/web-app-manifest-192x192.png",
  "/web-app-manifest-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
    ]).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) => ![SHELL_CACHE, RUNTIME_CACHE, STATIC_CACHE].includes(k),
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Handle navigation requests
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

  // Handle static assets (CSS, JS, images, fonts)
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    request.destination === "font" ||
    request.url.includes("/_next/static/") ||
    request.url.includes("/_next/") ||
    request.url.endsWith(".css") ||
    request.url.endsWith(".js") ||
    request.url.endsWith(".png") ||
    request.url.endsWith(".ico") ||
    request.url.endsWith(".svg") ||
    request.url.endsWith(".woff") ||
    request.url.endsWith(".woff2")
  ) {
    event.respondWith(
      (async () => {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          // Fetch from network and cache
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch (_) {
          // If network fails and no cache, return a basic response for CSS
          if (request.destination === "style") {
            return new Response("/* Offline - styles not available */", {
              headers: { "Content-Type": "text/css" },
            });
          }
          return new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  if (request.url.endsWith("/share-target")) {
    event.respondWith(
      (async () => {
        const clonedRequest = event.request.clone();
        const response = await fetch("/api/share", {
          method: "POST",
          body: await clonedRequest.formData(),
          headers: {
            cookie: request.headers.get("cookie") || "",
          },
          credentials: "include"
        });

        return Response.redirect("/close", 303);
      })()
    );
  }

  // Handle other requests with cache-first strategy
  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, response.clone());
        }
        return response;
      } catch (_) {
        return new Response("Offline", { status: 503 });
      }
    })(),
  );
});
