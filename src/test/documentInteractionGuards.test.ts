import { describe, expect, it } from 'vitest';

import {
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
});
