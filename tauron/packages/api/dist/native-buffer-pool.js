// Reconstructed Tauron guest binding: native-buffer-pool.
//
// See transport.js header for why this file exists. The pool lane is reported
// as unavailable so Explorer directory snapshots / preview byte reads take
// their generated-invoke fallbacks (src/runtime/explorerNativePool.ts,
// src/runtime/explorerBackend.ts).

export function isNativeBufferPoolAvailable() {
  return false;
}

export async function withNativePooledBufferOnce(request) {
  void request;
  throw new Error(
    'TAURON_GUEST_UNAVAILABLE: withNativePooledBufferOnce needs the Tauron ' +
      'native buffer-pool guest transport (tauron/packages/api/dist).',
  );
}

export async function nativeBufferPoolTelemetry() {
  return {
    available: false,
    leasedBytes: 0,
    pooledBytes: 0,
    inFlight: 0,
  };
}
