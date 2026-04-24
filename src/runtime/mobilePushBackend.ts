import { commands, unwrapTauriResult } from "./tauriClient";

export interface MobilePushSubscriptionKeysInput {
  p256dh: string;
  auth: string;
}

export interface MobilePushSubscriptionInput {
  endpoint: string;
  keys: MobilePushSubscriptionKeysInput;
  expirationTime: number | null;
  deviceLabel?: string;
  userAgent?: string;
  standalone: boolean;
}

export interface MobilePushSubscriptionRemovalRequest {
  endpoint: string;
}

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

export interface MobilePushDispatchResult {
  deliveredCount: number;
  failedCount: number;
  subscriptionCount: number;
}

export interface MobilePushDownloadNotificationRequest {
  absolutePath: string;
  shareUrl: string;
}

export async function getMobilePushConfig(): Promise<MobilePushConfigResponse> {
  return unwrapTauriResult(await commands.mobilePushGetConfig());
}

export async function registerMobilePushSubscription(
  input: MobilePushSubscriptionInput,
): Promise<MobilePushConfigResponse> {
  return unwrapTauriResult(
    await commands.mobilePushRegisterSubscription(input),
  );
}

export async function unregisterMobilePushSubscription(
  request: MobilePushSubscriptionRemovalRequest,
): Promise<MobilePushConfigResponse> {
  return unwrapTauriResult(
    await commands.mobilePushUnregisterSubscription(request),
  );
}

export async function sendMobileDownloadNotification(
  request: MobilePushDownloadNotificationRequest,
): Promise<MobilePushDispatchResult> {
  return unwrapTauriResult(
    await commands.mobilePushSendDownloadNotification(request),
  );
}
