import { getManagedContentDirectory } from './appContentDirectories';
import { resolveRuntimeAssetPollingEnabled } from './runtimeAssetPolling';

export function resolveAnimationsDirectory(): string {
  return getManagedContentDirectory('animations');
}

export const animationSystemConfig = {
  get animationsDirectory(): string {
    return resolveAnimationsDirectory();
  },
  frontendExtensions: ['tsx', 'ts', 'jsx', 'js'] as const,
  runtimeModuleName: 'overlayterm-animation',
  runtimeAssetPollingEnabled: resolveRuntimeAssetPollingEnabled(),
  scanIntervalMs: 2000,
  defaultOpenAnimationId: 'spring-lift',
  defaultCloseAnimationId: 'burn',
};

export type FrontendAnimationExtension =
  typeof animationSystemConfig.frontendExtensions[number];

export function resolvePreferredAnimationId(args: {
  availableAnimationIds: Iterable<string>;
  userOverrideId?: string | null;
  themeDefaultAnimationId?: string | null;
  fallbackAnimationId?: string;
}): string {
  const available = new Set(Array.from(args.availableAnimationIds));
  const fallbackId = args.fallbackAnimationId ?? animationSystemConfig.defaultOpenAnimationId;
  const preferredIds = [
    args.userOverrideId,
    args.themeDefaultAnimationId,
    fallbackId,
  ];

  for (const candidate of preferredIds) {
    if (typeof candidate === 'string' && candidate.trim() && available.has(candidate)) {
      return candidate;
    }
  }

  return available.has(fallbackId) ? fallbackId : Array.from(available)[0] ?? fallbackId;
}
