// Reconstructed Tauron guest binding (CJS): native-buffer-pool. See native-buffer-pool.js.
'use strict';
function isNativeBufferPoolAvailable() { return false; }
async function withNativePooledBufferOnce(request) {
  void request;
  throw new Error('TAURON_GUEST_UNAVAILABLE: withNativePooledBufferOnce needs the Tauron native buffer-pool guest transport.');
}
async function nativeBufferPoolTelemetry() {
  return { available: false, leasedBytes: 0, pooledBytes: 0, inFlight: 0 };
}
module.exports = { isNativeBufferPoolAvailable, withNativePooledBufferOnce, nativeBufferPoolTelemetry };
