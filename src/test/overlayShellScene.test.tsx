import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OverlayShellScene } from '../components/OverlayShellScene';
import { resolveOverlayAppearance } from '../config/appearance';

describe('OverlayShellScene', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps stable shell content from rerendering during folder animation progress ticks', () => {
    let frameTime = 0;
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => window.setTimeout(() => {
        frameTime += 16;
        callback(frameTime);
      }, 16) as unknown as number);
    const cancelAnimationFrameSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation((handle: number) => {
        window.clearTimeout(handle);
      });

    let contentRenderCount = 0;
    function StableShellContent() {
      contentRenderCount += 1;
      return <div data-testid="stable-shell-content">Explorer</div>;
    }

    const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
    const shellContent = <StableShellContent />;
    const { rerender } = render(
      <OverlayShellScene
        animation={{
          id: 'builtin:none',
          name: 'Instant',
          filePath: 'builtin:none',
          animationRoot: 'builtin',
          source: 'built-in',
          modified: 0,
          group: 'Built-in Motion',
          tags: ['builtin'],
          open: null,
          close: null,
          error: null,
        }}
        phase="open"
        direction="enter"
        durationMs={160}
        baseOpacity={1}
        intensity={1}
        verticalOrigin="bottom"
        accentColor="#66ccff"
        blurStrength={0}
        zoom={1}
        theme={appearance.theme}
        viewportWidth={1280}
        viewportHeight={720}
        frameStyle={{ position: 'relative', width: '100%', height: '100%' }}
        transformOrigin="bottom left"
        containerStyle={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}
        backgroundLayers={<div data-testid="background-layers" />}
        contentLayer={shellContent}
        showAnimationOverlay={false}
      />,
    );

    expect(contentRenderCount).toBe(1);

    rerender(
      <OverlayShellScene
        animation={{
          id: 'theme:andromeda-gate',
          name: 'Andromeda Gate',
          filePath: 'themes/andromeda/animations/andromeda-gate.tsx',
          animationRoot: 'themes/andromeda/animations',
          source: 'folder',
          modified: 0,
          group: 'Custom',
          tags: ['folder'],
          open: null,
          close: null,
          error: null,
        }}
        phase="opening"
        direction="enter"
        durationMs={160}
        baseOpacity={1}
        intensity={1}
        verticalOrigin="bottom"
        accentColor="#66ccff"
        blurStrength={0}
        zoom={1}
        theme={appearance.theme}
        viewportWidth={1280}
        viewportHeight={720}
        frameStyle={{ position: 'relative', width: '100%', height: '100%' }}
        transformOrigin="bottom left"
        containerStyle={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}
        backgroundLayers={<div data-testid="background-layers" />}
        contentLayer={shellContent}
        showAnimationOverlay={false}
      />,
    );
    const renderCountAfterModeSwitch = contentRenderCount;

    vi.advanceTimersByTime(176);

    expect(contentRenderCount).toBe(renderCountAfterModeSwitch);

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });
});
