// Reconstructed Tauron guest binding: transport.
//
// The repo snapshot ships the Tauron *Rust* lane (tauron/crates/tauri,
// src-tauri/src/{message_ring,native_pool_snapshots,preview_streaming}.rs)
// but the Tauron JS guest package (tauron/packages/api) was never committed,
// so `file:./tauron/packages/api/dist` cannot resolve on a fresh clone.
//
// This file restores the guest surface used by src/ with the same semantics:
// - invokeBinary: WORKS. Binary Tauri commands return byte arrays over the
//   standard invoke bridge (slower than the native shared-buffer lane, but
//   byte-identical). Hot path for preview/thumbnail byte reads.
// - resourceUrl / subscribeStreamPackets: UNAVAILABLE. They need the native
//   shared-buffer/ring transport that only the real Tauron guest + WRY patch
//   provide. They fail fast with TAURON_GUEST_UNAVAILABLE so callers and the
//   deslopp pass can grep for the missing lane instead of chasing silent 404s.
//
// Restore the real guest implementation from the Tauron fork when available;
// keep every export name stable so callers never change.

import { invoke } from './core.js';

function decodeBase64ToBytes(value) {
  if (typeof globalThis.Buffer !== 'undefined') {
    return new Uint8Array(globalThis.Buffer.from(value, 'base64'));
  }
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Invoke a binary Tauri command and coerce the JSON-bridge payload back to
 * bytes. Accepts the shapes a Vec<u8>/byte-buffer return can take across the
 * standard invoke bridge.
 */
export async function invokeBinary(command, args) {
  const raw = await invoke(command, args);
  if (raw instanceof Uint8Array) {
    return raw;
  }
  if (Array.isArray(raw)) {
    return Uint8Array.from(raw);
  }
  if (typeof raw === 'string') {
    return decodeBase64ToBytes(raw);
  }
  if (raw != null && typeof raw === 'object' && Array.isArray(raw.data)) {
    return Uint8Array.from(raw.data);
  }
  throw new Error(
    `transport.invokeBinary: unexpected payload shape from '${command}' ` +
      `(expected Uint8Array, number[] or base64 string).`,
  );
}

/** Native shared-resource URL. Requires the real Tauron guest transport. */
export function resourceUrl(resourceRid) {
  throw new Error(
    `TAURON_GUEST_UNAVAILABLE: resourceUrl(${String(resourceRid)}) needs the ` +
      'Tauron native shared-buffer transport (tauron/packages/api/dist). ' +
      'Reconstruct it from the Tauron fork or route the caller through invokeBinary.',
  );
}

/** Native transport stream subscription. Requires the real Tauron guest transport. */
export async function subscribeStreamPackets(handle, listener, options) {
  void handle;
  void listener;
  void options;
  throw new Error(
    'TAURON_GUEST_UNAVAILABLE: subscribeStreamPackets needs the Tauron ' +
      'native transport (tauron/packages/api/dist). No ipc_replay_stream ' +
      'endpoint exists in the generated bindings, so there is no ' +
      'invoke-based replay fallback to offer.',
  );
}
