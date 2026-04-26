import { listen } from "@tauri-apps/api/event";
import type { IpcStreamHandle } from "../../generated/tauri";
import { commands, unwrapTauriResult } from "../tauriClient";

export type ManagedIpcStreamHandle = IpcStreamHandle;

export interface SubscribeIpcStreamOptions {
  releaseOnUnsubscribe?: boolean | null;
}

export async function subscribeIpcStream<TPayload>(
  handle: ManagedIpcStreamHandle,
  listener: (payload: TPayload) => void,
  options: SubscribeIpcStreamOptions = {},
): Promise<() => void> {
  const unlisten = await listen<TPayload>(handle.eventName, (event) => {
    listener(event.payload);
  });

  return () => {
    unlisten();
    if (options.releaseOnUnsubscribe ?? true) {
      void commands
        .ipcReleaseStream(handle.id)
        .then(unwrapTauriResult)
        .catch(() => {});
    }
  };
}
