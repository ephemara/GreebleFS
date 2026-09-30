// Tauron guest API source stub: kain bridge (mirrors dist/kain.js).
export interface KainBridgeRequest<Args = unknown> {
  namespace: string;
  method: string;
  args?: Args;
  [key: string]: unknown;
}
export interface KainBridgeStatus {
  available: boolean;
  [key: string]: unknown;
}
export type KainReloadOptions = Record<string, unknown>;
export type KainReloadResult = { reloaded: boolean; [key: string]: unknown };
export async function status(): Promise<KainBridgeStatus> {
  throw new Error('stub source only; see dist/kain.js');
}
