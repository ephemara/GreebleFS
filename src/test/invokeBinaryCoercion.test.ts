import { describe, expect, it } from 'vitest';
// Regression test for "Text preview unavailable — transport.invokeBinary:
// unexpected payload shape". The Tauron Rust lane delivers Raw IPC bodies to
// the invoke callback as `new Uint8Array([...]).buffer` (ArrayBuffer) for
// small payloads and via the fetch lane for larger ones — never as a bare
// Uint8Array. coerceBinaryPayload must accept all of these.
import { coerceBinaryPayload } from '../../tauron/packages/api/dist/transport.js';

describe('coerceBinaryPayload (binary IPC shapes)', () => {
  it('passes Uint8Array through untouched', () => {
    const input = new Uint8Array([1, 2, 3]);
    expect(coerceBinaryPayload(input)).toBe(input);
  });

  it('accepts ArrayBuffer (small-payload direct-eval path)', () => {
    const out = coerceBinaryPayload(new Uint8Array([10, 20, 30]).buffer);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out!)).toEqual([10, 20, 30]);
  });

  it('accepts DataView / TypedArray views', () => {
    const buf = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    const view = new DataView(buf, 1, 3);
    const out = coerceBinaryPayload(view);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out!)).toEqual([2, 3, 4]);
  });

  it('accepts number[] (macOS eval / JSON-bridge path)', () => {
    const out = coerceBinaryPayload([7, 8, 9]);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out!)).toEqual([7, 8, 9]);
  });

  it('accepts { data: number[] } Result-JSON envelope', () => {
    const out = coerceBinaryPayload({ status: 'ok', data: [4, 5] });
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out!)).toEqual([4, 5]);
  });

  it('unwraps channel frames { message: <bytes>, index }', () => {
    const out = coerceBinaryPayload({
      message: new Uint8Array([9, 9]).buffer,
      index: 0,
    });
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out!)).toEqual([9, 9]);
  });

  it('returns null for non-byte shapes', () => {
    expect(coerceBinaryPayload(null)).toBeNull();
    expect(coerceBinaryPayload(undefined)).toBeNull();
    expect(coerceBinaryPayload(42)).toBeNull();
    expect(coerceBinaryPayload({ nope: true })).toBeNull();
  });
});
