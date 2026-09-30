// Reconstructed Tauron guest binding (CJS): kain bridge. See kain.js.
'use strict';
function unavailable(op) {
  return new Error(`TAURON_GUEST_UNAVAILABLE: kain.${op} needs the Tauron kain guest transport.`);
}
async function status() { throw unavailable('status'); }
async function manifest() { throw unavailable('manifest'); }
async function reflection() { throw unavailable('reflection'); }
async function dispatch(request) { void request; throw unavailable('dispatch'); }
async function call(namespace, method, args, correlationId) {
  void namespace; void method; void args; void correlationId;
  throw unavailable('call');
}
async function reload(options) { void options; throw unavailable('reload'); }
module.exports = { status, manifest, reflection, dispatch, call, reload };
