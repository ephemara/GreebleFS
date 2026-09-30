// Tauron guest API source stub: native-stream (mirrors dist/native-stream.js).
export interface NativeByteStreamPacket {
  streamId: string;
  sequence: number;
  bytes: Uint8Array;
  [key: string]: unknown;
}
export function isNativeStreamAvailable(): boolean {
  return false;
}
export async function subscribeNativeByteStream(
  streamId: string,
  onPacket: (packet: NativeByteStreamPacket) => void,
): Promise<() => void> {
  void streamId;
  void onPacket;
  throw new Error('stub source only; see dist/native-stream.js');
}
export async function nativeByteStreamTelemetry(): Promise<Record<string, unknown>> {
  return { available: false };
}
