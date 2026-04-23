import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { LanShareResult } from "../generated/tauri";
import type { MobileRemoteAccessMode } from "../config/mobileAccess";

export async function lanShareStart(
  path: string,
  shareMode: string = "mobile",
  hubPaths: string[] | null = null,
  remoteAccessMode: MobileRemoteAccessMode | null = null,
): Promise<LanShareResult> {
  return invoke<LanShareResult>("lan_share_start", {
    path,
    shareMode,
    hubPaths,
    remoteAccessMode,
  });
}

export async function lanShareStop(): Promise<void> {
  return invoke<void>("lan_share_stop");
}

export async function lanShareGetLocalIp(): Promise<string> {
  return invoke<string>("lan_share_get_local_ip");
}

export interface UrlDropPayload {
  urls: string[];
  position: { x: number; y: number };
}

/**
 * Hook or initialize URL drop listeners.
 */
export async function initializeUrlDropListener(
  onDragEnter?: (payload: UrlDropPayload) => void,
  onDrop?: (payload: UrlDropPayload) => void
) {
  const unlistenEnter = await listen<UrlDropPayload>("app://url-drag-enter", (event) => {
    if (onDragEnter) {
      onDragEnter(event.payload);
    }
  });

  const unlistenDrop = await listen<UrlDropPayload>("app://url-drop", (event) => {
    if (onDrop) {
      onDrop(event.payload);
    }
  });

  return () => {
    unlistenEnter();
    unlistenDrop();
  };
}
