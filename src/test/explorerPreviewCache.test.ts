import { describe, expect, it } from 'vitest';
import { ExplorerPreviewCache } from '../components/explorer/explorerPreviewCache';

describe('ExplorerPreviewCache', () => {
  it('evicts the oldest cached preview when the budget is exceeded', () => {
    const cache = new ExplorerPreviewCache<string>(12);

    expect(
      cache.write({
        key: 'preview:first',
        path: '/tmp/first.txt',
        value: 'first',
        bytes: 6,
      }),
    ).toEqual([]);
    expect(
      cache.write({
        key: 'preview:second',
        path: '/tmp/second.txt',
        value: 'second',
        bytes: 6,
      }),
    ).toEqual([]);

    const evictedKeys = cache.write({
      key: 'preview:third',
      path: '/tmp/third.txt',
      value: 'third',
      bytes: 6,
    });

    expect(evictedKeys).toEqual(['preview:first']);
    expect(cache.read('preview:first')).toBeNull();
    expect(cache.read('preview:second')).toBe('second');
    expect(cache.read('preview:third')).toBe('third');
    expect(cache.getStats()).toMatchObject({
      currentBytes: 12,
      entryCount: 2,
    });
  });
});
