// Reconstructed Tauron guest binding: kain bridge.
//
// See transport.js header for why this file exists. The Kain bridge probe
// (src/runtime/kainTauronBridge.ts: probeKainTauronBridge) catches these
// errors and reports { available: false }, which is the correct state until
// the real guest ships.

function unavailable(op) {
  return new Error(
    `TAURON_GUEST_UNAVAILABLE: kain.${op} needs the Tauron kain guest ` +
      'transport (tauron/packages/api/dist).',
  );
}

export async function status() {
  throw unavailable('status');
}

export async function manifest() {
  throw unavailable('manifest');
}

export async function reflection() {
  throw unavailable('reflection');
}

export async function dispatch(request) {
  void request;
  throw unavailable('dispatch');
}

export async function call(namespace, method, args, correlationId) {
  void namespace;
  void method;
  void args;
  void correlationId;
  throw unavailable('call');
}

export async function reload(options) {
  void options;
  throw unavailable('reload');
}
