// Reconstructed Tauron guest binding types: native-control.
export interface NativeControlCapabilities {
  available: boolean;
  hostObject: string | null;
  protocolVersion: number;
  dataPlane: string;
  [key: string]: unknown;
}
export declare function isNativeControlAvailable(): boolean;
export declare function nativeCall<TResult = unknown, TArgs = unknown>(
  namespace: string,
  method: string,
  args?: TArgs,
  options?: { correlationId?: string; [key: string]: unknown },
): Promise<TResult>;
export declare function nativeControlCapabilities(): Promise<NativeControlCapabilities>;
