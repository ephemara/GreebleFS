const MOBILE_SHELL_CACHE = "greeblefs-mobile-shell-v2";
const APP_SHELL_PATHS = new Set([
  "/",
  "/manifest.webmanifest",
  "/app-icon.png",
  "/apple-touch-icon.png",
]);

function normalizePushIntent(rawData) {
  if (!rawData || typeof rawData !== "object") {
    return null;
  }

  const data = rawData;
  const url =
    typeof data.url === "string" && data.url.trim().length > 0
      ? data.url.trim()
      : "/";
  const relativePath =
    typeof data.relativePath === "string" ? data.relativePath.trim() : "";
  const parentPath =
    typeof data.parentPath === "string" ? data.parentPath.trim() : "";
  const displayName =
    typeof data.displayName === "string" && data.displayName.trim().length > 0
      ? data.displayName.trim()
      : "file";
  const kind =
    typeof data.kind === "string" && data.kind.trim().length > 0
      ? data.kind.trim()
      : "download";

  if (!relativePath) {
    return null;
  }

  return {
    url,
    relativePath,
    parentPath,
    displayName,
    kind,
  };
}

async function broadcastDownloadIntent(intent) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  await Promise.all(
    clients.map(async (client) => {
      client.postMessage({
        type: "greeblefs-mobile-open-download",
        intent,
      });
    }),
  );
}

async function focusOrOpenClientForIntent(intent) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of clients) {
    const clientUrl = new URL(client.url);
    if (clientUrl.origin !== self.location.origin) {
      continue;
    }

    try {
      await client.navigate(intent.url);
    } catch (_error) {
      // Focus the existing client even if navigation is not allowed.
    }
    client.postMessage({
      type: "greeblefs-mobile-open-download",
      intent,
    });
    if ("focus" in client) {
      await client.focus();
    }
    return client;
  }

  return self.clients.openWindow(intent.url);
}

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

self.addEventListener("push", (event) => {
  const rawPayload = (() => {
    if (!event.data) {
      return null;
    }

    try {
      return event.data.json();
    } catch (_error) {
      return null;
    }
  })();

  const intent = normalizePushIntent(rawPayload?.data);
  const title =
    typeof rawPayload?.title === "string" && rawPayload.title.trim().length > 0
      ? rawPayload.title.trim()
      : "GreebleFS";
  const body =
    typeof rawPayload?.body === "string" && rawPayload.body.trim().length > 0
      ? rawPayload.body.trim()
      : "Your paired desktop sent a file.";
  const tag =
    typeof rawPayload?.tag === "string" && rawPayload.tag.trim().length > 0
      ? rawPayload.tag.trim()
      : "greeblefs-mobile";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: intent,
      icon: "/app-icon.png",
      badge: "/apple-touch-icon.png",
      renotify: true,
      requireInteraction: rawPayload?.requireInteraction === true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const intent = normalizePushIntent(event.notification.data);
  if (!intent) {
    event.waitUntil(self.clients.openWindow("/"));
    return;
  }

  event.waitUntil(
    (async () => {
      await broadcastDownloadIntent(intent);
      await focusOrOpenClientForIntent(intent);
    })(),
  );
});
