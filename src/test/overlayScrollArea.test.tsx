import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OverlayScrollArea } from '../components/OverlayScrollArea';

function getViewport(container: HTMLElement, direction: 'horizontal' | 'vertical'): HTMLDivElement {
  const node = container.querySelector(`.overlay-scroll-area__viewport--${direction}`);
  if (!node || !(node instanceof HTMLDivElement)) {
    throw new Error(`Missing viewport element for direction "${direction}".`);
  }
  return node;
}

describe('OverlayScrollArea', () => {
  it('maps vertical wheel delta to horizontal scrolling in horizontal mode', () => {
    const { container } = render(
      <OverlayScrollArea direction="horizontal">
        <div style={{ width: 2000 }}>content</div>
      </OverlayScrollArea>,
    );

    const viewport = getViewport(container, 'horizontal');
    viewport.scrollLeft = 10;

    const wheelEvent = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 0, deltaY: 36 });
    viewport.dispatchEvent(wheelEvent);

    expect(viewport.scrollLeft).toBe(46);
  });

  it('ignores wheel translation when horizontal intent is already dominant', () => {
    const { container } = render(
      <OverlayScrollArea direction="horizontal">
        <div style={{ width: 2000 }}>content</div>
      </OverlayScrollArea>,
    );

    const viewport = getViewport(container, 'horizontal');
    viewport.scrollLeft = 12;

    const wheelEvent = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 48, deltaY: 12 });
    viewport.dispatchEvent(wheelEvent);

    expect(viewport.scrollLeft).toBe(12);
    expect(wheelEvent.defaultPrevented).toBe(false);
  });

  it('does not remap wheel events in vertical mode', () => {
    const { container } = render(
      <OverlayScrollArea direction="vertical">
        <div>content</div>
      </OverlayScrollArea>,
    );

    const viewport = getViewport(container, 'vertical');
    viewport.scrollLeft = 20;

    const wheelEvent = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 0, deltaY: 40 });
    viewport.dispatchEvent(wheelEvent);

    expect(viewport.scrollLeft).toBe(20);
    expect(wheelEvent.defaultPrevented).toBe(false);
  });
});
