// Reconstructed Tauron guest binding (CJS): native-control. See native-control.js.
'use strict';
function isNativeControlAvailable() { return false; }
async function nativeCall(namespace, method, args, options) {
  void args; void options;
  throw new Error(`TAURON_GUEST_UNAVAILABLE: nativeCall('${namespace}', '${method}') needs the Tauron native-control guest transport.`);
}
async function nativeControlCapabilities() {
  return { available: false, hostObject: null, protocolVersion: 0, dataPlane: 'invoke-fallback' };
}
module.exports = { isNativeControlAvailable, nativeCall, nativeControlCapabilities };
