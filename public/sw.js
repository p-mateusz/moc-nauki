const CACHE_NAME = "moc-nauki-v2";
const APP_SHELL = ["/", "/index.html", "/manifest.json", "/favicon.ico"];
const STATIC_ASSET_PATTERN = /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|otf)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cacheName) => {
        if (cacheName !== CACHE_NAME) {
          return caches.delete(cacheName);
        }
        return Promise.resolve(false);
      }),
    )),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isViteAsset = url.pathname.includes("/.vite/") || url.pathname.includes("/node_modules/.vite/");
  const isDynamicAsset = /\.(?:js|mjs|css|map)$/i.test(url.pathname) || url.searchParams.has("v");
  const isApiRequest = url.pathname.startsWith("/api") || url.href.includes("supabase") || url.href.includes("googleapis");

  if (!isSameOrigin || isApiRequest || isViteAsset || isDynamicAsset) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/index.html")),
    );
    return;
  }

  if (!STATIC_ASSET_PATTERN.test(url.pathname) && !APP_SHELL.includes(url.pathname)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    }),
  );
});
