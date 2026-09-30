// Reconstructed Tauron guest binding: native-control.
//
// See transport.js header for why this file exists. The native-control lane
// (WebView2 shared-buffer RPC) is reported as unavailable so every caller
// takes its designed generated-invoke fallback (see
// src/runtime/nativeControl.ts: callGreebleNativeWithInvokeFallback).

export function isNativeControlAvailable() {
  return false;
}

export async function nativeCall(namespace, method, args, options) {
  void args;
  void options;
  throw new Error(
    `TAURON_GUEST_UNAVAILABLE: nativeCall('${namespace}', '${method}') needs ` +
      'the Tauron native-control guest transport (tauron/packages/api/dist).',
  );
}

export async function nativeControlCapabilities() {
  return {
    available: false,
    hostObject: null,
    protocolVersion: 0,
    dataPlane: 'invoke-fallback',
  };
}
