import { describe, expect, it } from 'vitest';
import { normalizeKainFfiCatalog } from '../runtime/kainFfiCatalog';

describe('normalizeKainFfiCatalog', () => {
  it('keeps valid Kain FFI catalog documents', () => {
    const catalog = normalizeKainFfiCatalog({
      schemaVersion: 1,
      kind: 'greeblefs.ffi.catalog',
      name: 'Kain FFI',
      source: 'src-kain/app/main.kn',
      registry: 'src-kain/ffi/registry.kn',
      root: 'src-kain/ffi',
      summary: 'Cross-language bridge map.',
      lanes: [
        {
          id: 'python',
          label: 'Python FFI',
          kind: 'python-sidecar',
          sourcePath: 'src-kain/ffi/python',
          hostPath: 'src-python/greeblefs_sidecar/actions.py:kain.ffi.catalog',
          bridge: 'GreebleFS Python sidecar',
          status: 'sidecar-hooked',
          implemented: true,
          summary: 'Python analysis lane.',
          nextAction: 'Build analyzer.',
        },
      ],
      analysisPipelines: ['ts-frontend-ui-inventory'],
      consumers: ['src/runtime/kainFfiCatalog.ts'],
    });

    expect(catalog?.name).toBe('Kain FFI');
    expect(catalog?.lanes[0]?.id).toBe('python');
    expect(catalog?.lanes[0]?.implemented).toBe(true);
    expect(catalog?.analysisPipelines).toContain('ts-frontend-ui-inventory');
  });

  it('rejects invalid Kain FFI catalog documents', () => {
    expect(normalizeKainFfiCatalog(null)).toBeNull();
    expect(normalizeKainFfiCatalog({ schemaVersion: 1, kind: 'wrong' })).toBeNull();
    expect(normalizeKainFfiCatalog({ schemaVersion: 0, kind: 'greeblefs.ffi.catalog' })).toBeNull();
  });
});
