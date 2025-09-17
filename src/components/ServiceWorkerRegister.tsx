"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const controller = new AbortController();

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        // Optional: listen for updates and prompt reload
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New content is available; could show a toast or auto-reload
              // location.reload();
            }
          });
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("SW registration failed", err);
      }
    };

    register();
    const onOnline = () => {
      document.documentElement.classList.remove("offline");
      if (document.title.startsWith("[Offline] ")) {
        document.title = document.title.replace(/^\[Offline\]\s+/, "");
      }
    };
    const onOffline = () => {
      document.documentElement.classList.add("offline");
      if (!document.title.startsWith("[Offline] ")) {
        document.title = `[Offline] ${document.title}`;
      }
    };
    window.addEventListener("online", onOnline, { signal: controller.signal });
    window.addEventListener("offline", onOffline, {
      signal: controller.signal,
    });
    if (!navigator.onLine) onOffline();
    else onOnline();
    return () => controller.abort();
  }, []);

  return null;
}
