// Reconstructed Tauron guest binding types: kain bridge.
export interface KainBridgeRequest<Args = unknown> {
  namespace: string;
  method: string;
  args?: Args;
  correlationId?: string;
  [key: string]: unknown;
}
export interface KainBridgeStatus {
  available: boolean;
  [key: string]: unknown;
}
export interface KainReloadOptions {
  [key: string]: unknown;
}
export interface KainReloadResult {
  reloaded: boolean;
  [key: string]: unknown;
}
export declare function status(): Promise<KainBridgeStatus>;
export declare function manifest<T = unknown>(): Promise<T>;
export declare function reflection<T = unknown>(): Promise<T>;
export declare function dispatch<T = unknown, Args = unknown>(
  request: KainBridgeRequest<Args>,
): Promise<T>;
export declare function call<T = unknown, Args = unknown>(
  namespace: string,
  method: string,
  args?: Args,
  correlationId?: string,
): Promise<T>;
export declare function reload(options?: KainReloadOptions): Promise<KainReloadResult>;
