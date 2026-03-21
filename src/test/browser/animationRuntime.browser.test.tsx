import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AnimationOverlayLayer,
  resolveAnimationShellStyle,
  type LoadedOverlayAnimation,
  type OverlayAnimationRenderContext,
} from '../../components/animationRuntime';
import { resolveOverlayAppearance } from '../../config/appearance';

function createAnimationContext(): OverlayAnimationRenderContext {
  const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
  return {
    animation: {
      id: 'test-animation',
      name: 'Test Animation',
      filePath: 'builtin:test-animation',
      animationRoot: 'builtin',
      source: 'built-in',
    },
    phase: 'open',
    direction: 'enter',
    progress: 0.5,
    durationMs: 220,
    baseOpacity: 0.92,
    intensity: 0.6,
    verticalOrigin: 'bottom',
    accentColor: appearance.theme.palette.accent,
    blurStrength: 12,
    zoom: 1,
    theme: appearance.theme,
    viewport: {
      width: 1440,
      height: 900,
      anchoredTo: 'bottom',
    },
  };
}

function createAnimation(overrides: Partial<LoadedOverlayAnimation>): LoadedOverlayAnimation {
  return {
    id: 'test-animation',
    name: 'Test Animation',
    filePath: 'builtin:test-animation',
    animationRoot: 'builtin',
    source: 'built-in',
    modified: 0,
    description: 'test animation',
    group: 'Tests',
    tags: ['test'],
    open: null,
    close: null,
    error: null,
    ...overrides,
  };
}

describe('animation runtime browser coverage', () => {
  it('falls back to an empty shell style when an animation style resolver throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const context = createAnimationContext();
    const animation = createAnimation({
      open: {
        resolveShellStyle: () => {
          throw new Error('style boom');
        },
      },
    });

    expect(resolveAnimationShellStyle(animation, context)).toEqual({});
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('recovers from a throwing animation overlay after switching animations', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const context = createAnimationContext();
    const crashingAnimation = createAnimation({
      name: 'Crash Animation',
      open: {
        renderOverlay: () => {
          throw new Error('overlay boom');
        },
      },
    });
    const stableAnimation = createAnimation({
      id: 'stable-animation',
      name: 'Stable Animation',
      open: {
        renderOverlay: () => <div data-testid="stable-animation-overlay">overlay</div>,
      },
    });

    const { rerender, container } = render(
      <AnimationOverlayLayer animation={crashingAnimation} context={context} />,
    );

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalled();
      expect(container.querySelector('[data-testid="stable-animation-overlay"]')).toBeNull();
    });

    rerender(<AnimationOverlayLayer animation={stableAnimation} context={context} />);

    expect(await screen.findByTestId('stable-animation-overlay')).toBeInTheDocument();
  });
});
