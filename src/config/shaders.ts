import { getManagedContentDirectory } from './appContentDirectories';
import { resolveRuntimeAssetPollingEnabled } from './runtimeAssetPolling';

export const overlayShaderSurfaces = [
  {
    id: 'background',
    label: 'Background',
    description: 'Renders behind the shell content and theme visual layers.',
  },
  {
    id: 'topBar',
    label: 'Top Bar',
    description: 'Renders inside the chrome bar layer behind the tabs and controls.',
  },
  {
    id: 'border',
    label: 'Border',
    description: 'Renders along the shell edge accents and resize rails.',
  },
] as const;

export type OverlayShaderSurfaceId = typeof overlayShaderSurfaces[number]['id'];

export type ShaderPerformanceMode = 'performance' | 'balanced' | 'quality';

export interface ShaderPerformanceProfile {
  id: ShaderPerformanceMode;
  label: string;
  description: string;
  shellUsesThemeDefault: boolean;
  previewPixelRatioCap: number;
  previewFrameRate: number;
  previewDefaultScene: 'sphere' | 'fullscreen';
  previewSphereSegments: number;
  previewSphereRings: number;
}

export const shaderPerformanceProfiles = [
  {
    id: 'performance',
    label: 'Performance',
    description: 'Disable automatic theme shader assignment and keep the preview host on the lowest-cost path.',
    shellUsesThemeDefault: false,
    previewPixelRatioCap: 1,
    previewFrameRate: 24,
    previewDefaultScene: 'fullscreen',
    previewSphereSegments: 16,
    previewSphereRings: 10,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Follow the theme default shader while keeping the preview host capped and restrained.',
    shellUsesThemeDefault: true,
    previewPixelRatioCap: 1.25,
    previewFrameRate: 24,
    previewDefaultScene: 'fullscreen',
    previewSphereSegments: 24,
    previewSphereRings: 14,
  },
  {
    id: 'quality',
    label: 'Quality',
    description: 'Follow the theme default shader and spend more budget on the live preview host.',
    shellUsesThemeDefault: true,
    previewPixelRatioCap: 2,
    previewFrameRate: 60,
    previewDefaultScene: 'sphere',
    previewSphereSegments: 32,
    previewSphereRings: 18,
  },
] as const satisfies readonly ShaderPerformanceProfile[];

const shaderPerformanceProfileMap = new Map<ShaderPerformanceMode, ShaderPerformanceProfile>(
  shaderPerformanceProfiles.map(profile => [profile.id, profile]),
);

export function resolveShadersDirectory(): string {
  return getManagedContentDirectory('shaders');
}

export const shaderSystemConfig = {
  get shadersDirectory(): string {
    return resolveShadersDirectory();
  },
  frontendExtensions: ['tsx', 'ts', 'jsx', 'js'] as const,
  runtimeModuleName: 'overlayterm-shader',
  runtimeAssetPollingEnabled: resolveRuntimeAssetPollingEnabled(),
  scanIntervalMs: 2000,
  fallbackShaderId: 'none',
  defaultPerformanceMode: 'performance' as ShaderPerformanceMode,
};

export type FrontendShaderExtension =
  typeof shaderSystemConfig.frontendExtensions[number];

export function getOverlayShaderSurfaceLabel(surface: OverlayShaderSurfaceId): string {
  return overlayShaderSurfaces.find(entry => entry.id === surface)?.label ?? surface;
}

export function getShaderEnabledSurfaceIds(shader: {
  background?: unknown;
  topBar?: unknown;
  border?: unknown;
} | null | undefined): OverlayShaderSurfaceId[] {
  if (!shader) {
    return [];
  }

  return overlayShaderSurfaces
    .filter(surface => Boolean(shader[surface.id]))
    .map(surface => surface.id);
}

export function getShaderPerformanceProfile(
  mode?: ShaderPerformanceMode | null,
): ShaderPerformanceProfile {
  return shaderPerformanceProfileMap.get(mode ?? shaderSystemConfig.defaultPerformanceMode)
    ?? shaderPerformanceProfiles[0];
}

export function resolvePreferredShaderId(args: {
  availableShaderIds: Iterable<string>;
  userOverrideId?: string | null;
  themeDefaultShaderId?: string | null;
  fallbackShaderId?: string;
  performanceMode?: ShaderPerformanceMode | null;
}): string {
  const available = new Set(Array.from(args.availableShaderIds));
  const fallbackId = args.fallbackShaderId ?? shaderSystemConfig.fallbackShaderId;
  const performanceProfile = getShaderPerformanceProfile(args.performanceMode);
  const preferredIds = [
    args.userOverrideId,
    performanceProfile.shellUsesThemeDefault ? args.themeDefaultShaderId : null,
    fallbackId,
  ];

  for (const candidate of preferredIds) {
    if (typeof candidate === 'string' && candidate.trim() && available.has(candidate)) {
      return candidate;
    }
  }

  return available.has(fallbackId) ? fallbackId : Array.from(available)[0] ?? fallbackId;
}
