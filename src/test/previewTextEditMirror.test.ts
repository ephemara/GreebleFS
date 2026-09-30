import { describe, expect, it } from 'vitest';
import {
  buildPreviewTextEditorKey,
  createPreviewTextEditMirror,
  nextPreviewTextContentRevision,
} from '../runtime/previewTextEditMirror';

describe('previewTextEditMirror', () => {
  it('stages keystrokes and reads them back over the saved fallback', () => {
    const mirror = createPreviewTextEditMirror();
    expect(mirror.read('/a.txt', 'saved')).toBe('saved');
    mirror.stage('/a.txt', 'saved + typing');
    expect(mirror.read('/a.txt', 'saved')).toBe('saved + typing');
    expect(mirror.hasPending('/a.txt')).toBe(true);
  });

  it('isolates paths and discards on clean save', () => {
    const mirror = createPreviewTextEditMirror();
    mirror.stage('/a.txt', 'aaa');
    expect(mirror.read('/b.txt', 'bbb')).toBe('bbb');
    expect(mirror.hasPending('/b.txt')).toBe(false);
    mirror.discard('/b.txt');
    expect(mirror.hasPending('/a.txt')).toBe(true);
    mirror.discard('/a.txt');
    expect(mirror.hasPending('/a.txt')).toBe(false);
    expect(mirror.read('/a.txt', 'saved')).toBe('saved');
  });

  it('discard() with no path clears everything', () => {
    const mirror = createPreviewTextEditMirror();
    mirror.stage('/a.txt', 'aaa');
    mirror.discard();
    expect(mirror.peek()).toBeNull();
  });

  it('issues unique monotonic revisions for editor remount keys', () => {
    const a = nextPreviewTextContentRevision();
    const b = nextPreviewTextContentRevision();
    expect(b).toBeGreaterThan(a);
    expect(buildPreviewTextEditorKey('/a.txt', a)).not.toBe(
      buildPreviewTextEditorKey('/a.txt', b),
    );
    expect(buildPreviewTextEditorKey('/a.txt', a)).toBe(
      buildPreviewTextEditorKey('/a.txt', a),
    );
  });
});
