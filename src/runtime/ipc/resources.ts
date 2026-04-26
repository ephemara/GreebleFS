import type { IpcResourceHandle } from "../../generated/tauri";
import { commands, unwrapTauriResult } from "../tauriClient";

export type ManagedIpcResourceHandle = IpcResourceHandle;

export async function releaseIpcResource(
  resource: string | ManagedIpcResourceHandle,
): Promise<void> {
  const id = typeof resource === "string" ? resource : resource.id;
  unwrapTauriResult(await commands.ipcReleaseResource(id));
}
