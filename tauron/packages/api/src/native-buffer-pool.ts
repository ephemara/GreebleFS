// Tauron guest API source stub: native-buffer-pool (mirrors dist/native-buffer-pool.js).
export interface NativeBufferPoolTelemetry {
  available: boolean;
  [key: string]: unknown;
}
export function isNativeBufferPoolAvailable(): boolean {
  return false;
}
export async function withNativePooledBufferOnce<TDecoded = unknown>(request: {
  namespace: string;
  method: string;
  args?: unknown;
  decode: (bytes: Uint8Array) => TDecoded;
}): Promise<TDecoded> {
  void request;
  throw new Error('stub source only; see dist/native-buffer-pool.js');
}
export async function nativeBufferPoolTelemetry(): Promise<NativeBufferPoolTelemetry> {
  return { available: false };
}
