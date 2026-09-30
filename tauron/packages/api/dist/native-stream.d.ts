// Reconstructed Tauron guest binding types: native-stream.
export interface NativeByteStreamPacket {
  streamId: string;
  sequence: number;
  bytes: Uint8Array;
  [key: string]: unknown;
}
export interface NativeByteStreamTelemetry {
  available: boolean;
  activeStreams: number;
  packetsDelivered: number;
  bytesDelivered: number;
  replayGaps: number;
  [key: string]: unknown;
}
export declare function isNativeStreamAvailable(): boolean;
export declare function subscribeNativeByteStream(
  streamId: string,
  onPacket: (packet: NativeByteStreamPacket) => void,
): Promise<() => void>;
export declare function nativeByteStreamTelemetry(): Promise<NativeByteStreamTelemetry>;
