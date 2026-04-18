import { multiplyColorAlpha } from '../../config/appearance';
import type { ResolvedWorkbenchTerminalFxRecipe } from '../../config/workbenchTheme';

export type TerminalRendererMode = 'dom' | 'webgl';

export interface TerminalViewportFxTheme {
  accent: string;
  border: string;
  text: string;
}

export interface TerminalViewportFxProps {
  active: boolean;
  outputActive: boolean;
  paneId: string;
  rendererMode: TerminalRendererMode;
  terminalFx: ResolvedWorkbenchTerminalFxRecipe;
  theme: TerminalViewportFxTheme;
}

function formatFilterNumber(value: number): string {
  return value.toFixed(3);
}

export function buildTerminalViewportContentFilter(
  terminalFx: ResolvedWorkbenchTerminalFxRecipe,
  rendererMode: TerminalRendererMode,
  active: boolean,
  outputActive: boolean,
): string | undefined {
  if (!terminalFx.enabled || terminalFx.opacity <= 0.001 || rendererMode === 'webgl' || outputActive) {
    return undefined;
  }

  const activityMix = active ? 1 : 0.82;
  const contrastBoost = terminalFx.contrast * 0.42 * activityMix;
  const saturationBoost = terminalFx.saturation * 0.56 * activityMix;
  const parts = [
    `contrast(${formatFilterNumber(1 + contrastBoost)})`,
    `saturate(${formatFilterNumber(1 + saturationBoost)})`,
  ];

  return parts.join(' ');
}

export function TerminalViewportFx({
  active,
  outputActive,
  paneId,
  rendererMode,
  terminalFx,
  theme,
}: TerminalViewportFxProps) {
  if (!terminalFx.enabled || terminalFx.opacity <= 0.001 || rendererMode === 'webgl' || outputActive) {
    return null;
  }

  const activityMix = active ? 1 : 0.78;
  const fxOpacity = terminalFx.opacity * activityMix;
  const scanlineColor = multiplyColorAlpha(theme.text, terminalFx.scanlineOpacity * fxOpacity);
  const noiseColor = multiplyColorAlpha(theme.text, terminalFx.noiseOpacity * fxOpacity * 0.72);
  const vignetteColor = multiplyColorAlpha('#000000', terminalFx.vignetteOpacity * fxOpacity);
  const tintTopColor = multiplyColorAlpha(
    terminalFx.tintColor,
    terminalFx.tintOpacity * fxOpacity * 0.5,
  );
  const tintBottomColor = multiplyColorAlpha(
    terminalFx.tintColor,
    terminalFx.tintOpacity * fxOpacity,
  );
  const glowColor = multiplyColorAlpha(
    terminalFx.tintColor,
    terminalFx.glowOpacity * fxOpacity * 0.42,
  );
  const borderGlowColor = multiplyColorAlpha(theme.border, 0.48 * fxOpacity);
  const curvatureShade = multiplyColorAlpha('#000000', terminalFx.curvature * fxOpacity * 0.18);
  const curvatureScale = 1 - terminalFx.curvature * 0.022;

  return (
    <div
      aria-hidden="true"
      data-terminal-fx-preset={terminalFx.preset}
      data-testid={`terminal-pane-fx-${paneId}`}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ borderRadius: 'inherit' }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(180deg, ${scanlineColor} 0 1px, transparent 1px 4px)`,
          opacity: terminalFx.scanlineOpacity > 0.001 ? 1 : 0,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(140% 118% at 50% 48%, transparent 44%, ${vignetteColor} 100%), linear-gradient(180deg, ${tintTopColor} 0%, transparent 34%, ${tintBottomColor} 100%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at 17% 23%, ${noiseColor} 0 1px, transparent 1.2px), radial-gradient(circle at 83% 31%, ${noiseColor} 0 1px, transparent 1.2px), radial-gradient(circle at 61% 69%, ${noiseColor} 0 1px, transparent 1.2px), radial-gradient(circle at 31% 78%, ${noiseColor} 0 1px, transparent 1.2px)`,
          backgroundSize: '19px 19px, 27px 27px, 31px 31px, 23px 23px',
          opacity: terminalFx.noiseOpacity > 0.001 ? 1 : 0,
        }}
      />
      <div
        className="absolute inset-[2px]"
        style={{
          borderRadius: 'inherit',
          backgroundImage: `radial-gradient(125% 76% at 50% -8%, ${curvatureShade} 0%, transparent 52%), radial-gradient(125% 76% at 50% 108%, ${curvatureShade} 0%, transparent 52%)`,
          transform: terminalFx.curvature > 0.001 ? `scaleY(${curvatureScale.toFixed(4)})` : undefined,
          transformOrigin: 'center center',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          borderRadius: 'inherit',
          boxShadow: `inset 0 0 ${Math.round(18 + terminalFx.glowOpacity * 24)}px ${glowColor}, inset 0 0 0 1px ${borderGlowColor}`,
          opacity: 0.96,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          borderRadius: 'inherit',
          boxShadow: `inset 0 1px 0 ${multiplyColorAlpha(theme.accent, 0.18 * fxOpacity)}`,
        }}
      />
    </div>
  );
}
