import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ShaderSurfaceLayer,
  resolveShaderSurfaceStyle,
  type LoadedOverlayShader,
} from '../components/shaderRuntime';
import { createShaderRenderContext, createShaderShellContext, createThrowingComponent } from './helpers/runtimeFixtures';

function makeShader(overrides: Partial<LoadedOverlayShader> = {}): LoadedOverlayShader {
  return {
    id: 'failing-shader',
    name: 'Failing Shader',
    filePath: 'shaders/failing-shader.tsx',
    shaderRoot: 'shaders',
    source: 'folder',
    modified: 1,
    description: 'Unit test shader',
    group: 'Custom',
    tags: [],
    controls: [],
    resolveSharedUniforms: undefined,
    background: null,
    topBar: null,
    border: null,
    error: null,
    ...overrides,
  };
}

describe('shaderRuntime boundaries', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns an empty style when the surface style resolver throws', () => {
    const shader = makeShader({
      background: {
        resolveStyle: () => {
          throw new Error('style exploded');
        },
      },
    });

    const style = resolveShaderSurfaceStyle(shader, createShaderRenderContext());

    expect(style).toEqual({});
    expect(console.warn).toHaveBeenCalledWith(
      'OverlayTerm: shader surface style failed for Failing Shader (background)',
      expect.any(Error),
    );
  });

  it('renders nothing when a shader surface is missing', () => {
    const shader = makeShader();

    const { container } = render(
      <ShaderSurfaceLayer
        shader={shader}
        shellContext={createShaderShellContext()}
        surface="background"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('recovers after a throwing shader surface is replaced', async () => {
    const throwingShader = makeShader({
      name: 'Throwing Shader',
      background: {
        render: createThrowingComponent('shader surface exploded'),
      },
    });
    const recoveredShader = makeShader({
      name: 'Recovered Shader',
      background: {
        render: () => <div>recovered shader</div>,
      },
    });
    const shellContext = createShaderShellContext();

    const { container, rerender } = render(
      <ShaderSurfaceLayer
        shader={throwingShader}
        shellContext={shellContext}
        surface="background"
      />,
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });

    rerender(
      <ShaderSurfaceLayer
        shader={recoveredShader}
        shellContext={shellContext}
        surface="background"
      />,
    );

    expect(await screen.findByText('recovered shader')).toBeInTheDocument();
  });
});
