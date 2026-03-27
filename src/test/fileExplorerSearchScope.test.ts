import { describe, expect, it } from 'vitest';
import { resolveExplorerSearchScope } from '../components/fileExplorerSearchScope';

describe('resolveExplorerSearchScope()', () => {
  it('derives unique scoped search channels from instance ids', () => {
    const firstScope = resolveExplorerSearchScope(':r1:');
    const secondScope = resolveExplorerSearchScope(':r2:');

    expect(firstScope).toBe('file-explorer:r1');
    expect(secondScope).toBe('file-explorer:r2');
    expect(firstScope).not.toBe(secondScope);
  });

  it('falls back to a stable instance token when the id is blank', () => {
    expect(resolveExplorerSearchScope('   ')).toBe('file-explorer:instance');
  });
});
