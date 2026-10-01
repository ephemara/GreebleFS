// Reconstructed Tauron guest binding types: transport.
export declare function coerceBinaryPayload(raw: unknown, depth?: number): Uint8Array | null;
export declare function invokeBinary(command: string, args?: unknown): Promise<Uint8Array>;
export declare function resourceUrl(resourceRid: number): string;
export interface TransportStreamPacketMetadata {
  sequence: number;
  streamId?: string | null;
  [key: string]: unknown;
}
export interface TransportStreamPacket<TPayload = unknown> {
  metadata: TransportStreamPacketMetadata;
  payload: TPayload;
}
export interface TransportStreamSubscribeOptions {
  includeReplay?: boolean;
  replayFromSequence?: number;
  replayLimit?: number;
  closeOnUnsubscribe?: boolean;
}
export declare function subscribeStreamPackets<TPayload = unknown>(
  handle: unknown,
  listener: (packet: TransportStreamPacket<TPayload>) => void,
  options?: TransportStreamSubscribeOptions,
): Promise<() => void>;
