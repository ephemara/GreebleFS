// Reconstructed Tauron guest binding types: native-buffer-pool.
export interface NativeBufferPoolTelemetry {
  available: boolean;
  leasedBytes: number;
  pooledBytes: number;
  inFlight: number;
  [key: string]: unknown;
}
export interface NativePooledBufferRequest<TDecoded = unknown> {
  namespace: string;
  method: string;
  args?: unknown;
  timeoutMs?: number;
  decode: (bytes: Uint8Array) => TDecoded;
}
export declare function isNativeBufferPoolAvailable(): boolean;
export declare function withNativePooledBufferOnce<TDecoded = unknown>(
  request: NativePooledBufferRequest<TDecoded>,
): Promise<TDecoded>;
export declare function nativeBufferPoolTelemetry(): Promise<NativeBufferPoolTelemetry>;
