// Reconstructed Tauron guest binding (CJS): native-stream. See native-stream.js.
'use strict';
function isNativeStreamAvailable() { return false; }
async function subscribeNativeByteStream(streamId, onPacket) {
  void streamId; void onPacket;
  throw new Error('TAURON_GUEST_UNAVAILABLE: subscribeNativeByteStream needs the Tauron native byte-stream guest transport.');
}
async function nativeByteStreamTelemetry() {
  return { available: false, activeStreams: 0, packetsDelivered: 0, bytesDelivered: 0, replayGaps: 0 };
}
module.exports = { isNativeStreamAvailable, subscribeNativeByteStream, nativeByteStreamTelemetry };
