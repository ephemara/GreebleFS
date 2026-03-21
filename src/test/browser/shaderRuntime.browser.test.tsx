import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ShaderSurfaceLayer,
  createBuiltInOverlayShaders,
  resolveShaderSharedUniforms,
  resolveShaderSurfaceStyle,
  type LoadedOverlayShader,
  type OverlayShaderRenderContext,
  type OverlayShaderShellContext,
} from '../../components/shaderRuntime';
import { resolveOverlayAppearance } from '../../config/appearance';

function createShellContext(): OverlayShaderShellContext {
  const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
  return {
    id: 'shader-shell',
    name: 'Shader Shell',
    filePath: 'builtin:test',
    shaderRoot: 'builtin',
    source: 'built-in',
    viewport: {
      width: 1440,
      height: 900,
    },
    accentColor: appearance.theme.palette.accent,
    theme: appearance.theme,
    panelTransparency: 0.3,
    blurStrength: 18,
    zoom: 1,
    isSettingsActive: false,
    shaderControlValues: {},
  };
}

function createRenderContext(): OverlayShaderRenderContext {
  const shellContext = createShellContext();
  return {
    ...shellContext,
    surface: 'background',
    sharedUniforms: {},
  };
}

function createShader(overrides: Partial<LoadedOverlayShader>): LoadedOverlayShader {
  return {
    id: 'test-shader',
    name: 'Test Shader',
    filePath: 'builtin:test-shader',
    shaderRoot: 'builtin',
    source: 'built-in',
    modified: 0,
    description: 'test shader',
    group: 'Tests',
    tags: ['test'],
    controls: [],
    resolveSharedUniforms: undefined,
    background: null,
    topBar: null,
    border: null,
    error: null,
    ...overrides,
  };
}

describe('shader runtime browser coverage', () => {
  it('falls back to empty uniforms and styles when shader resolvers throw', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const shellContext = createShellContext();
    const renderContext = createRenderContext();
    const shader = createShader({
      resolveSharedUniforms: () => {
        throw new Error('uniform boom');
      },
      background: {
        resolveStyle: () => {
          throw new Error('style boom');
        },
      },
    });

    expect(resolveShaderSharedUniforms(shader, shellContext)).toEqual({});
    expect(resolveShaderSurfaceStyle(shader, renderContext)).toEqual({});
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('recovers from a throwing shader surface after switching shaders', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const shellContext = createShellContext();
    const crashingShader = createShader({
      name: 'Crash Shader',
      background: {
        render: () => {
          throw new Error('render boom');
        },
      },
    });
    const stableShader = createShader({
      id: 'stable-shader',
      name: 'Stable Shader',
      background: {
        render: () => <div data-testid="stable-shader-surface">stable</div>,
      },
    });

    const { rerender, container } = render(
      <ShaderSurfaceLayer
        shader={crashingShader}
        shellContext={shellContext}
        surface="background"
      />,
    );

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalled();
      expect(container.querySelector('[data-testid="stable-shader-surface"]')).toBeNull();
    });

    rerender(
      <ShaderSurfaceLayer
        shader={stableShader}
        shellContext={shellContext}
        surface="background"
      />,
    );

    expect(await screen.findByTestId('stable-shader-surface')).toBeInTheDocument();
  });

  it('renders the built-in hologram background canvas in a real browser context', async () => {
    const shellContext = createShellContext();
    const hologramShader = createBuiltInOverlayShaders().find(shader => shader.id === 'hologram-grid');

    expect(hologramShader).toBeTruthy();

    const { container } = render(
      <ShaderSurfaceLayer
        shader={hologramShader ?? null}
        shellContext={shellContext}
        surface="background"
      />,
    );

    await waitFor(() => {
      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
      expect(canvas?.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
