export function resolveAnimationsDirectory(): string {
  const configured = (import.meta.env as {
    VITE_OVERLAYTERM_ANIMATIONS_DIR?: string;
  }).VITE_OVERLAYTERM_ANIMATIONS_DIR?.trim();
  return configured && configured.length > 0 ? configured : 'animations';
}

export const animationSystemConfig = {
  animationsDirectory: resolveAnimationsDirectory(),
  frontendExtensions: ['tsx', 'ts', 'jsx', 'js'] as const,
  runtimeModuleName: 'overlayterm-animation',
  scanIntervalMs: 2000,
  defaultOpenAnimationId: 'spring-lift',
  defaultCloseAnimationId: 'burn',
} as const;

export type FrontendAnimationExtension =
  typeof animationSystemConfig.frontendExtensions[number];
