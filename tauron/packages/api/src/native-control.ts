// Tauron guest API source stub: native-control (mirrors dist/native-control.js).
export interface NativeControlCapabilities {
  available: boolean;
  hostObject: string | null;
  protocolVersion: number;
  dataPlane: string;
  [key: string]: unknown;
}
export function isNativeControlAvailable(): boolean {
  return false;
}
export async function nativeCall<TResult = unknown, TArgs = unknown>(
  namespace: string,
  method: string,
  args?: TArgs,
  options?: Record<string, unknown>,
): Promise<TResult> {
  void namespace;
  void method;
  void args;
  void options;
  throw new Error('stub source only; see dist/native-control.js');
}
export async function nativeControlCapabilities(): Promise<NativeControlCapabilities> {
  return { available: false, hostObject: null, protocolVersion: 0, dataPlane: 'invoke-fallback' };
}
