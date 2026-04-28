import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverlayScrollArea } from '../components/OverlayScrollArea';

function getViewport(container: HTMLElement, direction: 'horizontal' | 'vertical'): HTMLDivElement {
  const node = container.querySelector(`.overlay-scroll-area__viewport--${direction}`);
  if (!node || !(node instanceof HTMLDivElement)) {
    throw new Error(`Missing viewport element for direction "${direction}".`);
  }
  return node;
}

function makeScrollable(
  viewport: HTMLDivElement,
  metrics: { clientHeight?: number; scrollHeight?: number; clientWidth?: number; scrollWidth?: number },
) {
  for (const [key, value] of Object.entries(metrics)) {
    Object.defineProperty(viewport, key, {
      configurable: true,
      value,
    });
  }
}

describe('OverlayScrollArea', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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

  it('uses the explicit themed scrollbar contract when requested', () => {
    const { container } = render(
      <OverlayScrollArea scrollbarStyle="themed">
        <div>content</div>
      </OverlayScrollArea>,
    );

    const viewport = getViewport(container, 'vertical');
    expect(viewport.dataset.overlayScrollbarStyle).toBe('themed');
    expect(viewport.classList.contains('overlay-scroll-area__viewport--scrollbar-themed')).toBe(true);
  });

  it('maps explorer file-list scrollbar styling through the public prop', () => {
    const { container } = render(
      <OverlayScrollArea scrollbarStyle="explorer-file-list">
        <div>content</div>
      </OverlayScrollArea>,
    );

    const viewport = getViewport(container, 'vertical');
    expect(viewport.dataset.overlayScrollbarStyle).toBe('explorer-file-list');
    expect(viewport.classList.contains('overlay-scroll-area__viewport--explorer-file-list')).toBe(true);
  });

  it('renders app-owned scrollbar chrome when themed scrolling overflows', async () => {
    const { container } = render(
      <OverlayScrollArea scrollbarStyle="themed">
        <div>content</div>
      </OverlayScrollArea>,
    );

    const viewport = getViewport(container, 'vertical');
    const verticalTrack = container.querySelector('.overlay-scroll-area__scrollbar--vertical');
    const verticalThumb = container.querySelector('.overlay-scroll-area__scrollbar-thumb--vertical');
    if (!(verticalTrack instanceof HTMLDivElement) || !(verticalThumb instanceof HTMLDivElement)) {
      throw new Error('Missing custom vertical scrollbar chrome.');
    }

    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      value: 120,
    });
    Object.defineProperty(viewport, 'scrollHeight', {
      configurable: true,
      value: 720,
    });
    Object.defineProperty(verticalTrack, 'clientHeight', {
      configurable: true,
      value: 120,
    });

    viewport.dispatchEvent(new Event('scroll'));

    await waitFor(() => {
      expect(verticalTrack.dataset.visible).toBe('true');
      expect(Number.parseFloat(verticalThumb.style.height)).toBeGreaterThan(0);
    });
  });

  it('shrinks the thumb as the content range grows denser', async () => {
    const { container } = render(
      <OverlayScrollArea scrollbarStyle="themed">
        <div>content</div>
      </OverlayScrollArea>,
    );

    const viewport = getViewport(container, 'vertical');
    const verticalTrack = container.querySelector('.overlay-scroll-area__scrollbar--vertical');
    const verticalThumb = container.querySelector('.overlay-scroll-area__scrollbar-thumb--vertical');
    if (!(verticalTrack instanceof HTMLDivElement) || !(verticalThumb instanceof HTMLDivElement)) {
      throw new Error('Missing custom vertical scrollbar chrome.');
    }

    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      value: 120,
    });
    Object.defineProperty(verticalTrack, 'clientHeight', {
      configurable: true,
      value: 120,
    });

    Object.defineProperty(viewport, 'scrollHeight', {
      configurable: true,
      value: 240,
    });
    viewport.dispatchEvent(new Event('scroll'));

    let sparseHeight = 0;
    await waitFor(() => {
      sparseHeight = Number.parseFloat(verticalThumb.style.height);
      expect(sparseHeight).toBeGreaterThan(50);
    });

    Object.defineProperty(viewport, 'scrollHeight', {
      configurable: true,
      value: 7200,
    });
    viewport.dispatchEvent(new Event('scroll'));

    await waitFor(() => {
      const denseHeight = Number.parseFloat(verticalThumb.style.height);
      expect(denseHeight).toBeLessThan(sparseHeight / 2);
      expect(denseHeight).toBeLessThan(24);
    });
  });

  it('adds opt-in inertial scrolling that continues after a fast wheel event', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = render(
      <OverlayScrollArea scrollbarStyle="explorer-file-list" inertialScroll>
        <div style={{ height: 4000 }}>content</div>
      </OverlayScrollArea>,
    );

    const viewport = getViewport(container, 'vertical');
    makeScrollable(viewport, {
      clientHeight: 200,
      scrollHeight: 4000,
    });

    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    });
    viewport.dispatchEvent(wheelEvent);

    expect(wheelEvent.defaultPrevented).toBe(true);
    expect(viewport.scrollTop).toBe(120);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(180);
    });

    expect(viewport.scrollTop).toBeGreaterThan(180);
  });

  it('disables inertial scrolling when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const { container } = render(
      <OverlayScrollArea scrollbarStyle="explorer-file-list" inertialScroll>
        <div style={{ height: 4000 }}>content</div>
      </OverlayScrollArea>,
    );

    const viewport = getViewport(container, 'vertical');
    makeScrollable(viewport, {
      clientHeight: 200,
      scrollHeight: 4000,
    });

    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    });
    viewport.dispatchEvent(wheelEvent);

    expect(wheelEvent.defaultPrevented).toBe(false);
    expect(viewport.scrollTop).toBe(0);
  });
});
