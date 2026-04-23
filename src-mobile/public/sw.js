const MOBILE_SHELL_CACHE = "greeblefs-mobile-shell-v2";
const APP_SHELL_PATHS = new Set([
  "/",
  "/manifest.webmanifest",
  "/app-icon.png",
  "/apple-touch-icon.png",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(MOBILE_SHELL_CACHE)
      .then((cache) => cache.addAll(Array.from(APP_SHELL_PATHS)))
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
            .filter((key) => key !== MOBILE_SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(MOBILE_SHELL_CACHE);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached ?? networkFetch;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/files/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        return (
          (await caches.match("/")) ||
          new Response("Offline", {
            status: 503,
            statusText: "Offline",
          })
        );
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || APP_SHELL_PATHS.has(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
