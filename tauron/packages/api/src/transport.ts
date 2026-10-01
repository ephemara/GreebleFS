// Tauron guest API source stub: transport (mirrors dist/transport.js).
export async function invokeBinary(command: string, args?: unknown): Promise<Uint8Array> {
  void command;
  void args;
  throw new Error('stub source only; see dist/transport.js');
}
export function resourceUrl(resourceRid: number): string {
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__?.resolveCustomProtocolUrl) {
    return (window as any).__TAURI_INTERNALS__.resolveCustomProtocolUrl(String(resourceRid), 'transport');
  }
  return `http://transport.localhost/${encodeURIComponent(String(resourceRid))}`;
}
export interface TransportStreamPacket<TPayload = unknown> {
  metadata: { sequence: number; [key: string]: unknown };
  payload: TPayload;
}
export async function subscribeStreamPackets<TPayload = unknown>(
  handle: unknown,
  listener: (packet: TransportStreamPacket<TPayload>) => void,
  options?: Record<string, unknown>,
): Promise<() => void> {
  void handle;
  void listener;
  void options;
  throw new Error('stub source only; see dist/transport.js');
}
