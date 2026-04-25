/// <reference lib="WebWorker" />

import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope &
  typeof globalThis & {
    __WB_MANIFEST: Array<{
      url: string;
      revision?: string | null;
    }>;
  };

const MOBILE_ASSET_CACHE = "greeblefs-mobile-assets-v3";
const APP_SHELL_PATHS = new Set([
  "/",
  "/manifest.webmanifest",
  "/app-icon.png",
  "/apple-touch-icon.png",
]);

function normalizePushIntent(rawData: unknown) {
  if (!rawData || typeof rawData !== "object") {
    return null;
  }

  const data = rawData as Record<string, unknown>;
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

async function broadcastDownloadIntent(
  intent: ReturnType<typeof normalizePushIntent>,
) {
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

async function focusOrOpenClientForIntent(
  intent: NonNullable<ReturnType<typeof normalizePushIntent>>,
) {
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

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
void self.skipWaiting();
clientsClaim();

registerRoute(
  ({ request, url }) => {
    return (
      request.method === "GET" &&
      url.origin === self.location.origin &&
      !url.pathname.startsWith("/api/") &&
      !url.pathname.startsWith("/files/") &&
      (request.destination === "script" ||
        request.destination === "style" ||
        request.destination === "worker" ||
        request.destination === "image" ||
        APP_SHELL_PATHS.has(url.pathname))
    );
  },
  new StaleWhileRevalidate({
    cacheName: MOBILE_ASSET_CACHE,
  }),
);

registerRoute(
  ({ request, url }) =>
    request.method === "GET" &&
    request.mode === "navigate" &&
    url.origin === self.location.origin,
  async ({ event }) => {
    try {
      return await fetch(event.request);
    } catch (_error) {
      return (
        (await caches.match("/")) ||
        new Response("Offline", {
          status: 503,
          statusText: "Offline",
        })
      );
    }
  },
);

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

  const intent = normalizePushIntent(
    rawPayload && typeof rawPayload === "object"
      ? (rawPayload as Record<string, unknown>).data
      : null,
  );
  const title =
    rawPayload &&
    typeof rawPayload === "object" &&
    typeof (rawPayload as Record<string, unknown>).title === "string" &&
    (rawPayload as Record<string, string>).title.trim().length > 0
      ? (rawPayload as Record<string, string>).title.trim()
      : "GreebleFS";
  const body =
    rawPayload &&
    typeof rawPayload === "object" &&
    typeof (rawPayload as Record<string, unknown>).body === "string" &&
    (rawPayload as Record<string, string>).body.trim().length > 0
      ? (rawPayload as Record<string, string>).body.trim()
      : "Your paired desktop sent a file.";
  const tag =
    rawPayload &&
    typeof rawPayload === "object" &&
    typeof (rawPayload as Record<string, unknown>).tag === "string" &&
    (rawPayload as Record<string, string>).tag.trim().length > 0
      ? (rawPayload as Record<string, string>).tag.trim()
      : "greeblefs-mobile";
  const requireInteraction =
    rawPayload &&
    typeof rawPayload === "object" &&
    (rawPayload as Record<string, unknown>).requireInteraction === true;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: intent,
      icon: "/app-icon.png",
      badge: "/apple-touch-icon.png",
      renotify: true,
      requireInteraction,
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

export {};
