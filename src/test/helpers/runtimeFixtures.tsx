import { resolveOverlayAppearance } from '../../config/appearance';
import type { OverlayAnimationRenderContext } from '../../components/animationRuntime';
import type { LoadedOverlayAnimation } from '../../components/animationRuntime';
import type { LoadedOverlayShader } from '../../components/shaderRuntime';
import type { OverlayShaderRenderContext, OverlayShaderShellContext } from '../../components/shaderRuntime';

const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });

const defaultAnimation = {
  id: 'unit-animation',
  name: 'Unit Animation',
  filePath: 'animations/unit-animation.tsx',
  animationRoot: 'animations',
  source: 'folder' as const,
};

const defaultShader = {
  id: 'unit-shader',
  name: 'Unit Shader',
  filePath: 'shaders/unit-shader.tsx',
  shaderRoot: 'shaders',
  source: 'folder' as const,
};

export function createThrowingComponent(message = 'unit test render failure') {
  return function ThrowingComponent(): never {
    throw new Error(message);
  };
}

export function createAnimationRenderContext(
  overrides: Partial<OverlayAnimationRenderContext> = {},
): OverlayAnimationRenderContext {
  const animation = overrides.animation ?? {
    ...defaultAnimation,
  };

  return {
    animation,
    phase: 'opening',
    direction: 'enter',
    progress: 0.5,
    durationMs: 320,
    baseOpacity: 0.9,
    intensity: 1,
    verticalOrigin: 'bottom',
    accentColor: appearance.theme.palette.accent,
    blurStrength: 12,
    zoom: 1,
    theme: appearance.theme,
    viewport: {
      width: 1280,
      height: 720,
      anchoredTo: 'bottom',
    },
    ...overrides,
  };
}

export function createShaderShellContext(
  overrides: Partial<OverlayShaderShellContext> = {},
): OverlayShaderShellContext {
  const shader = overrides.id
    ? {
        id: overrides.id,
        name: overrides.name ?? defaultShader.name,
        filePath: overrides.filePath ?? defaultShader.filePath,
        shaderRoot: overrides.shaderRoot ?? defaultShader.shaderRoot,
        source: overrides.source ?? defaultShader.source,
      }
    : defaultShader;

  return {
    id: shader.id,
    name: shader.name,
    filePath: shader.filePath,
    shaderRoot: shader.shaderRoot,
    source: shader.source,
    viewport: {
      width: 1280,
      height: 720,
    },
    accentColor: appearance.theme.palette.accent,
    theme: appearance.theme,
    panelTransparency: 0.4,
    blurStrength: 12,
    zoom: 1,
    isSettingsActive: false,
    ...overrides,
  };
}

export function createShaderRenderContext(
  overrides: Partial<OverlayShaderRenderContext> = {},
): OverlayShaderRenderContext {
  const shellContext = createShaderShellContext(overrides);
  const surface = overrides.surface ?? 'background';

  return {
    ...shellContext,
    surface,
    sharedUniforms: overrides.sharedUniforms ?? {},
  };
}

export function makeLoadedAnimation(
  overrides: Partial<LoadedOverlayAnimation> = {},
): LoadedOverlayAnimation {
  return {
    ...defaultAnimation,
    modified: 1,
    description: 'unit animation',
    group: 'Custom',
    tags: [],
    open: null,
    close: null,
    error: null,
    ...overrides,
  };
}

export function makeLoadedShader(
  overrides: Partial<LoadedOverlayShader> = {},
): LoadedOverlayShader {
  return {
    ...defaultShader,
    modified: 1,
    description: 'unit shader',
    group: 'Custom',
    tags: [],
    resolveSharedUniforms: undefined,
    background: null,
    topBar: null,
    border: null,
    error: null,
    ...overrides,
  };
}
