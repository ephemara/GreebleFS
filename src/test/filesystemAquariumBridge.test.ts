import { describe, expect, it, vi } from 'vitest';

import {
  FILESYSTEM_AQUARIUM_OPEN_REQUEST_EVENT,
  FILESYSTEM_AQUARIUM_OPEN_REQUEST_STORAGE_KEY,
  createFilesystemAquariumOpenRequest,
  readFilesystemAquariumOpenRequest,
  requestFilesystemAquariumOpen,
} from '../runtime/filesystemAquariumBridge';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe('filesystemAquariumBridge', () => {
  it('creates normalized aquarium open requests', () => {
    const request = createFilesystemAquariumOpenRequest('  /tmp/project  ');

    expect(request.path).toBe('/tmp/project');
    expect(request.source).toBe('explorer');
    expect(request.nonce).toBeTruthy();
    expect(request.requestedAt).toBeTypeOf('number');
  });

  it('persists and dispatches aquarium open requests', () => {
    const storage = createMemoryStorage();
    const dispatchEvent = vi.fn();

    const request = requestFilesystemAquariumOpen(' /tmp/aquarium ', {
      storage,
      target: { dispatchEvent },
    });

    expect(request?.path).toBe('/tmp/aquarium');
    expect(readFilesystemAquariumOpenRequest(storage)?.path).toBe('/tmp/aquarium');
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls[0]?.[0]).toBeInstanceOf(CustomEvent);
    expect((dispatchEvent.mock.calls[0]?.[0] as CustomEvent).type).toBe(FILESYSTEM_AQUARIUM_OPEN_REQUEST_EVENT);
  });

  it('returns null for malformed persisted aquarium requests', () => {
    const storage = createMemoryStorage();
    storage.setItem(FILESYSTEM_AQUARIUM_OPEN_REQUEST_STORAGE_KEY, '{"path":""}');

    expect(readFilesystemAquariumOpenRequest(storage)).toBeNull();
  });
});
