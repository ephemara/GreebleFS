const monolithPalette = {
  text: '#ECFBFF',
  textMuted: 'rgba(197, 228, 234, 0.72)',
  accent: '#64F4D7',
  accentSoft: 'rgba(100, 244, 215, 0.18)',
  accentStrong: '#9BFFF0',
  accentGlow: 'rgba(100, 244, 215, 0.18)',
  ember: '#FF9C58',
  emberSoft: 'rgba(255, 156, 88, 0.16)',
  border: 'rgba(118, 212, 196, 0.18)',
  borderStrong: 'rgba(100, 244, 215, 0.34)',
  shell: 'rgba(5, 13, 18, 0.9)',
  shellStrong: 'rgba(7, 18, 24, 0.94)',
  card: 'rgba(8, 21, 27, 0.86)',
  cardStrong: 'rgba(9, 24, 31, 0.94)',
  stage: 'linear-gradient(180deg, rgba(10, 23, 30, 0.96), rgba(4, 10, 14, 0.98))',
  shadow: '0 28px 64px rgba(0, 0, 0, 0.42)',
  deepShadow: '0 36px 90px rgba(0, 0, 0, 0.56)',
};

export function resolveMonolithCssLength(host, name, fallback) {
  const value = host.appearance.cssVars?.[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

export function getMonolithTokens(host, mode) {
  const isDock = mode === 'dock';
  const baseInset = host.shellModel.layout.shellInset + (isDock ? 6 : 10);
  const gap = Math.max(12, host.shellModel.layout.panelGap + (isDock ? 0 : 2));
  const contentPadding = Math.max(12, host.shellModel.layout.contentInnerPadding + (isDock ? 0 : 4));

  return {
    ...monolithPalette,
    mode,
    shellInset: baseInset,
    gap,
    contentPadding,
    railWidth: resolveMonolithCssLength(
      host,
      '--overlay-workbench-monolith-rail-width',
      isDock ? '100%' : '296px',
    ),
    sideWidth: resolveMonolithCssLength(
      host,
      '--overlay-workbench-monolith-side-width',
      isDock ? '272px' : '312px',
    ),
    stageWidth: resolveMonolithCssLength(
      host,
      '--overlay-workbench-monolith-stage-width',
      isDock ? 'min(calc(100% - 28px), 1120px)' : 'min(calc(100% - 96px), 1320px)',
    ),
    stageHeight: resolveMonolithCssLength(
      host,
      '--overlay-workbench-monolith-stage-height',
      isDock ? 'min(56vh, 480px)' : 'min(calc(100% - 136px), 760px)',
    ),
    utilitySurfaceStyle: {
      padding: isDock ? 10 : 12,
      borderRadius: isDock ? 24 : 28,
      border: `1px solid ${monolithPalette.border}`,
      background: monolithPalette.card,
      boxShadow: monolithPalette.shadow,
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
    },
  };
}
