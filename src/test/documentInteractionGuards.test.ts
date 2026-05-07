import { describe, expect, it } from 'vitest';

import {
  hasNativeTextSelectionInAllowedSurface,
  isNativeTextSelectionSurfaceTarget,
  resolveEventTargetElement,
  shouldAllowDocumentSelection,
  shouldAllowNativeContextMenu,
} from '../runtime/documentInteractionGuards';

describe('document interaction guards', () => {
  it('resolves text node targets to their parent element', () => {
    const host = document.createElement('div');
    host.textContent = 'OverlayTerm';
    const textNode = host.firstChild;

    expect(resolveEventTargetElement(textNode)).toBe(host);
  });

  it('does not throw and denies native context menus for non-editable text node targets', () => {
    const host = document.createElement('div');
    host.textContent = 'Shell';
    const textNode = host.firstChild;

    expect(shouldAllowNativeContextMenu(textNode)).toBe(false);
  });

  it('allows selection for code-adjacent text node targets', () => {
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = 'const greeble = true;';
    pre.appendChild(code);
    const textNode = code.firstChild;

    expect(shouldAllowDocumentSelection(textNode)).toBe(true);
  });

  it('allows native context menus for editable descendants', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'notes';

    expect(shouldAllowNativeContextMenu(textarea)).toBe(true);
    expect(shouldAllowDocumentSelection(textarea)).toBe(true);
  });

  it('allows native text selection surfaces to own prose selection and copy menus', () => {
    const surface = document.createElement('div');
    surface.dataset.nativeTextSelectionSurface = 'true';
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Rendered markdown prose';
    surface.appendChild(paragraph);
    document.body.appendChild(surface);

    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(isNativeTextSelectionSurfaceTarget(paragraph.firstChild)).toBe(true);
    expect(shouldAllowNativeContextMenu(paragraph.firstChild)).toBe(true);
    expect(shouldAllowDocumentSelection(paragraph.firstChild)).toBe(true);
    expect(hasNativeTextSelectionInAllowedSurface(selection)).toBe(true);

    selection?.removeAllRanges();
    surface.remove();
  });
});
