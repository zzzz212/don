/* ЮрИИст service worker — minimal, conservative caching for an
 * installable PWA.
 *
 * Strategy:
 *   - /_next/static/* and hashed assets : cache-first (immutable)
 *   - page navigations                  : network-first, offline fallback
 *   - /api/*                            : never touched — straight to network
 *
 * A legal tool must not serve stale contracts or analyses, so dynamic
 * content is always network-first and API responses are never stored.
 * Bump VERSION to invalidate the caches on a breaking change. */

const VERSION = "v1";
const STATIC_CACHE = `juriist-static-${VERSION}`;
const SHELL_CACHE = `juriist-shell-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== SHELL_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // third-party — leave it
  if (url.pathname.startsWith("/api/")) return; // never cache API responses

  // Immutable hashed build assets — cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // Page navigations — network-first, fall back to the offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        const offline = await cache.match(OFFLINE_URL);
        return offline || Response.error();
      })
    );
    return;
  }

  // Static media / fonts — cache-first, best-effort.
  if (/\.(?:png|jpg|jpeg|svg|gif|webp|woff2?|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch (err) {
          return hit || Response.error();
        }
      })
    );
  }
});
