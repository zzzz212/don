"use client";

import { useEffect } from "react";

// Registers the service worker (public/sw.js) once, after load, in
// production only — a service worker in dev fights with hot reload.
// Renders nothing; mounted once in the root layout.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Best-effort — the app works fine without the SW; a failed
        // registration just means no offline fallback / asset caching.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
