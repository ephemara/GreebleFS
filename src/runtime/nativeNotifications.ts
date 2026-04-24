import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

export type NativeNotificationPermissionState = NotificationPermission | 'unavailable';

export interface NativeNotificationRequest {
  title: string;
  body?: string;
  icon?: string;
  requestPermission?: boolean;
}

function hasNativeNotificationSupport(): boolean {
  return typeof window !== 'undefined' && typeof window.Notification !== 'undefined';
}

export async function getNativeNotificationPermissionState(): Promise<NativeNotificationPermissionState> {
  if (!hasNativeNotificationSupport()) {
    return 'unavailable';
  }

  if (await isPermissionGranted().catch(() => false)) {
    return 'granted';
  }

  return window.Notification.permission;
}

export async function ensureNativeNotificationPermission(): Promise<boolean> {
  if (!hasNativeNotificationSupport()) {
    return false;
  }

  if (await isPermissionGranted().catch(() => false)) {
    return true;
  }

  const permission = await requestPermission().catch(() => 'denied' as NotificationPermission);
  return permission === 'granted';
}

export async function sendNativeNotification(request: NativeNotificationRequest): Promise<boolean> {
  if (!hasNativeNotificationSupport()) {
    return false;
  }

  let permissionGranted = await isPermissionGranted().catch(() => false);
  if (!permissionGranted && request.requestPermission !== false) {
    permissionGranted = await ensureNativeNotificationPermission();
  }

  if (!permissionGranted) {
    return false;
  }

  sendNotification({
    title: request.title,
    body: request.body,
    icon: request.icon,
  });
  return true;
}
