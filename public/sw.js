/*
 * Service worker for the installed (home screen) app.
 *
 * Deliberately conservative. The common way to get burned here is caching the
 * app shell aggressively and then shipping a deploy users never receive, so:
 *
 *  - navigations are network-first, falling back to cache only when offline,
 *    which means a deploy is picked up on the next launch;
 *  - build assets under /assets/ carry a content hash and are immutable, so
 *    they are cache-first;
 *  - /api/ responses are never cached;
 *  - cross-origin requests (Firebase, Firestore, fonts) are left alone
 *    entirely — Firestore does its own offline persistence.
 */

const CACHE = "chess-flashcards-v1";
const SHELL = "/index.html";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(SHELL, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(SHELL);
          if (cached) return cached;
          return new Response("Offline and no cached copy available.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        }
      })()
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        if (fresh.ok) {
          const cache = await caches.open(CACHE);
          cache.put(request, fresh.clone());
        }
        return fresh;
      })()
    );
  }
});
