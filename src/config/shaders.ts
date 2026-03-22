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

export function resolveShadersDirectory(): string {
  const configured = (import.meta.env as {
    VITE_OVERLAYTERM_SHADERS_DIR?: string;
  }).VITE_OVERLAYTERM_SHADERS_DIR?.trim();
  return configured && configured.length > 0 ? configured : 'shaders';
}

export const shaderSystemConfig = {
  shadersDirectory: resolveShadersDirectory(),
  frontendExtensions: ['tsx', 'ts', 'jsx', 'js'] as const,
  runtimeModuleName: 'overlayterm-shader',
  runtimeAssetPollingEnabled: resolveRuntimeAssetPollingEnabled(),
  scanIntervalMs: 2000,
  fallbackShaderId: 'none',
} as const;

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

export function resolvePreferredShaderId(args: {
  availableShaderIds: Iterable<string>;
  userOverrideId?: string | null;
  themeDefaultShaderId?: string | null;
  fallbackShaderId?: string;
}): string {
  const available = new Set(Array.from(args.availableShaderIds));
  const fallbackId = args.fallbackShaderId ?? shaderSystemConfig.fallbackShaderId;
  const preferredIds = [
    args.userOverrideId,
    args.themeDefaultShaderId,
    fallbackId,
  ];

  for (const candidate of preferredIds) {
    if (typeof candidate === 'string' && candidate.trim() && available.has(candidate)) {
      return candidate;
    }
  }

  return available.has(fallbackId) ? fallbackId : Array.from(available)[0] ?? fallbackId;
}
