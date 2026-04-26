import { commands } from "../tauriClient";

export type IpcBinaryLane =
  | "fsPreviewBytes"
  | "cloudPreviewBytes"
  | "remotePreviewBytes";

export async function readIpcBinaryBytes(
  lane: IpcBinaryLane,
  path: string,
  maxBytes: number,
): Promise<Uint8Array> {
  switch (lane) {
    case "cloudPreviewBytes":
      return commands.cloudReadPreviewBytes(path, maxBytes);
    case "remotePreviewBytes":
      return commands.remoteReadPreviewBytes(path, maxBytes);
    case "fsPreviewBytes":
    default:
      return commands.fsReadPreviewBytes(path, maxBytes);
  }
}
