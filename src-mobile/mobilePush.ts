export interface MobilePushPairedDeviceSummary {
  endpoint: string;
  deviceLabel: string;
  userAgent: string | null;
  standalone: boolean;
  updatedAtMs: number;
}

export interface MobilePushConfigResponse {
  supported: boolean;
  vapidPublicKey: string;
  subscriptionCount: number;
  pairedDevices: MobilePushPairedDeviceSummary[];
}

export interface MobilePushRuntimeSnapshot {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  config: MobilePushConfigResponse | null;
  subscription: PushSubscription | null;
}

export interface MobilePushNotificationIntent {
  url: string;
  relativePath: string;
  parentPath: string;
  displayName: string;
  kind: string;
}

function hasMobilePushSupport(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function getMobilePushPermission(): NotificationPermission | "unsupported" {
  if (!hasMobilePushSupport()) {
    return "unsupported";
  }
  return window.Notification.permission;
}

function base64UrlToUint8Array(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  const base64 = `${normalized}${"=".repeat(paddingLength)}`;
  const raw = window.atob(base64);
  const buffer = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    buffer[index] = raw.charCodeAt(index);
  }
  return buffer;
}

async function fetchMobilePushJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function getCurrentDeviceLabel(): string {
  const platformLabel = /iPhone/i.test(navigator.userAgent)
    ? "iPhone"
    : /iPad/i.test(navigator.userAgent)
      ? "iPad"
      : "Phone";
  return `Paired ${platformLabel}`;
}

function subscriptionToInput(
  subscription: PushSubscription,
): {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime: number | null;
  deviceLabel: string;
  userAgent: string;
  standalone: boolean;
} {
  const payload = subscription.toJSON();
  const keys = payload.keys;
  if (!keys?.p256dh || !keys.auth) {
    throw new Error("The browser did not provide push encryption keys.");
  }

  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    expirationTime:
      typeof subscription.expirationTime === "number"
        ? subscription.expirationTime
        : null,
    deviceLabel: getCurrentDeviceLabel(),
    userAgent: navigator.userAgent,
    standalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      // `navigator.standalone` is the iOS legacy standalone flag.
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  };
}

export async function fetchMobilePushConfig(): Promise<MobilePushConfigResponse> {
  return fetchMobilePushJson<MobilePushConfigResponse>("/api/push/config", {
    headers: {
      "Cache-Control": "no-cache",
    },
  });
}

export async function loadMobilePushRuntimeSnapshot(): Promise<MobilePushRuntimeSnapshot> {
  if (!hasMobilePushSupport()) {
    return {
      supported: false,
      permission: "unsupported",
      config: null,
      subscription: null,
    };
  }

  const [config, registration] = await Promise.all([
    fetchMobilePushConfig(),
    navigator.serviceWorker.ready,
  ]);
  const subscription = await registration.pushManager.getSubscription();

  return {
    supported: config.supported,
    permission: getMobilePushPermission(),
    config,
    subscription,
  };
}

export async function subscribeMobilePushNotifications(): Promise<MobilePushRuntimeSnapshot> {
  if (!hasMobilePushSupport()) {
    throw new Error("Push notifications are not available in this browser session.");
  }

  const permission = await window.Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const config = await fetchMobilePushConfig();
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(config.vapidPublicKey),
    });
  }

  const nextConfig = await fetchMobilePushJson<MobilePushConfigResponse>(
    "/api/push/subscribe",
    {
      method: "POST",
      body: JSON.stringify(subscriptionToInput(subscription)),
    },
  );

  return {
    supported: true,
    permission,
    config: nextConfig,
    subscription,
  };
}

export async function unsubscribeMobilePushNotifications(): Promise<MobilePushRuntimeSnapshot> {
  if (!hasMobilePushSupport()) {
    return {
      supported: false,
      permission: "unsupported",
      config: null,
      subscription: null,
    };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await fetchMobilePushJson<MobilePushConfigResponse>("/api/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({
        endpoint: subscription.endpoint,
      }),
    });
    await subscription.unsubscribe();
  }

  const config = await fetchMobilePushConfig();
  return {
    supported: true,
    permission: getMobilePushPermission(),
    config,
    subscription: null,
  };
}

export function listenToMobilePushMessages(
  onIntent: (intent: MobilePushNotificationIntent) => void,
): () => void {
  if (!("serviceWorker" in navigator)) {
    return () => undefined;
  }

  const handleMessage = (event: MessageEvent<unknown>) => {
    const payload = event.data as
      | {
          type?: string;
          intent?: MobilePushNotificationIntent;
        }
      | undefined;
    if (payload?.type !== "greeblefs-mobile-open-download" || !payload.intent) {
      return;
    }
    onIntent(payload.intent);
  };

  navigator.serviceWorker.addEventListener("message", handleMessage);
  return () => {
    navigator.serviceWorker.removeEventListener("message", handleMessage);
  };
}
