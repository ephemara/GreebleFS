import { Resource } from "@tauri-apps/api/core";
import type { IpcResourceHandle } from "../../generated/tauri";

export type ManagedIpcResourceHandle = IpcResourceHandle;

export async function releaseIpcResource(
  resource: number | ManagedIpcResourceHandle,
): Promise<void> {
  const rid = typeof resource === "number" ? resource : resource.rid;
  await new Resource(rid).close();
}
