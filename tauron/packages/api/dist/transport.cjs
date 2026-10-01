// Reconstructed Tauron guest binding (CJS): transport. See transport.js.
'use strict';
const { invoke } = require('./core.cjs');
function decodeBase64ToBytes(value) {
  if (typeof globalThis.Buffer !== 'undefined') {
    return new Uint8Array(globalThis.Buffer.from(value, 'base64'));
  }
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
async function invokeBinary(command, args) {
  const raw = await invoke(command, args);
  if (raw instanceof Uint8Array) return raw;
  if (Array.isArray(raw)) return Uint8Array.from(raw);
  if (typeof raw === 'string') return decodeBase64ToBytes(raw);
  if (raw != null && typeof raw === 'object' && Array.isArray(raw.data)) return Uint8Array.from(raw.data);
  throw new Error(`transport.invokeBinary: unexpected payload shape from '${command}'.`);
}
function resourceUrl(resourceRid) {
  if (typeof globalThis.window !== 'undefined' && globalThis.window.__TAURI_INTERNALS__?.resolveCustomProtocolUrl) {
    return globalThis.window.__TAURI_INTERNALS__.resolveCustomProtocolUrl(String(resourceRid), 'transport');
  }
  return `http://transport.localhost/${encodeURIComponent(String(resourceRid))}`;
}
async function subscribeStreamPackets(handle, listener, options) {
  void handle; void listener; void options;
  throw new Error('TAURON_GUEST_UNAVAILABLE: subscribeStreamPackets needs the Tauron native transport.');
}
module.exports = { invokeBinary, resourceUrl, subscribeStreamPackets };
