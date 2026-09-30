// Reconstructed Tauron guest binding: native-stream.
//
// See transport.js header for why this file exists. The byte-stream lane is
// reported as unavailable so terminal output / search streams take their
// invoke + Tauri-event fallbacks (src/components/TerminalOverlay.tsx,
// src/runtime/explorerNativeStreams.ts).

export function isNativeStreamAvailable() {
  return false;
}

export async function subscribeNativeByteStream(streamId, onPacket) {
  void streamId;
  void onPacket;
  throw new Error(
    'TAURON_GUEST_UNAVAILABLE: subscribeNativeByteStream needs the Tauron ' +
      'native byte-stream guest transport (tauron/packages/api/dist).',
  );
}

export async function nativeByteStreamTelemetry() {
  return {
    available: false,
    activeStreams: 0,
    packetsDelivered: 0,
    bytesDelivered: 0,
    replayGaps: 0,
  };
}
