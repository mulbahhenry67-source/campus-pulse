const CACHE_NAME = "campus-pulse-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept API calls or the WebSocket upgrade — these must always
  // hit the network live. Caching or replaying these would silently break
  // real-time messaging and serve stale matches/messages.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws")) {
    return;
  }

  // Navigations: try the network first (so users get fresh app code), fall
  // back to the cached shell, then to a dedicated offline page.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(
        () => caches.match(event.request).then((cached) => cached || caches.match("/offline.html")),
      ),
    );
    return;
  }

  // Static assets (JS/CSS/fonts/icons): cache-first, since Vite's build
  // output is content-hashed and safe to cache aggressively.
  if (event.request.method === "GET") {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          }),
      ),
    );
  }
});
