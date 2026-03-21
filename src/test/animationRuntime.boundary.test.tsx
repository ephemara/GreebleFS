import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnimationOverlayLayer,
  resolveAnimationShellStyle,
  type LoadedOverlayAnimation,
} from '../components/animationRuntime';
import { createAnimationRenderContext, createThrowingComponent } from './helpers/runtimeFixtures';

function makeAnimation(overrides: Partial<LoadedOverlayAnimation> = {}): LoadedOverlayAnimation {
  return {
    id: 'failing-animation',
    name: 'Failing Animation',
    filePath: 'animations/failing-animation.tsx',
    animationRoot: 'animations',
    source: 'folder',
    modified: 1,
    description: 'Unit test animation',
    group: 'Custom',
    tags: [],
    open: null,
    close: null,
    error: null,
    ...overrides,
  };
}

describe('animationRuntime boundaries', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns an empty style when the shell style resolver throws', () => {
    const animation = makeAnimation({
      open: {
        resolveShellStyle: () => {
          throw new Error('style exploded');
        },
      },
    });

    const style = resolveAnimationShellStyle(animation, createAnimationRenderContext());

    expect(style).toEqual({});
    expect(console.warn).toHaveBeenCalledWith(
      'OverlayTerm: animation shell style failed',
      'Failing Animation',
      expect.any(Error),
    );
  });

  it('renders nothing when the active variant is missing', () => {
    const animation = makeAnimation({
      open: {
        resolveShellStyle: () => ({ opacity: 0.8 }),
      },
      close: null,
    });

    const { container } = render(
      <AnimationOverlayLayer
        animation={animation}
        context={createAnimationRenderContext({ direction: 'exit' })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('recovers after a throwing animation overlay is replaced', async () => {
    const throwingAnimation = makeAnimation({
      name: 'Throwing Animation',
      open: {
        renderOverlay: createThrowingComponent('animation overlay exploded'),
      },
    });
    const recoveredAnimation = makeAnimation({
      name: 'Recovered Animation',
      open: {
        renderOverlay: () => <div>recovered animation</div>,
      },
    });
    const context = createAnimationRenderContext({ direction: 'enter' });

    const { container, rerender } = render(
      <AnimationOverlayLayer animation={throwingAnimation} context={context} />,
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });

    rerender(<AnimationOverlayLayer animation={recoveredAnimation} context={context} />);

    expect(await screen.findByText('recovered animation')).toBeInTheDocument();
  });
});
