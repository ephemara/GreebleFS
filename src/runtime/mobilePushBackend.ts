import type {
  MobilePushConfigResponse,
  MobilePushDispatchResult,
  MobilePushDownloadNotificationRequest,
  MobilePushSubscriptionInput,
  MobilePushSubscriptionRemovalRequest,
} from "../generated/tauri";
import { commands, unwrapTauriResult } from "./tauriClient";

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
