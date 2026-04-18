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
  paneId: string;
  rendererMode: TerminalRendererMode;
  terminalFx: ResolvedWorkbenchTerminalFxRecipe;
  theme: TerminalViewportFxTheme;
}

export function TerminalViewportFx({
  active,
  paneId,
  rendererMode,
  terminalFx,
  theme,
}: TerminalViewportFxProps) {
  if (!terminalFx.enabled || terminalFx.opacity <= 0.001 || rendererMode === 'webgl' || active) {
    return null;
  }

  const frameOpacity = terminalFx.opacity * 0.24;
  const borderColor = multiplyColorAlpha(theme.border, 0.62 * frameOpacity);
  const accentLine = multiplyColorAlpha(theme.accent, 0.14 * frameOpacity);
  const tintColor = multiplyColorAlpha(terminalFx.tintColor, terminalFx.tintOpacity * frameOpacity * 0.22);

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
          borderRadius: 'inherit',
          boxShadow: `inset 0 0 0 1px ${borderColor}, inset 0 1px 0 ${accentLine}`,
          backgroundImage: `linear-gradient(180deg, ${tintColor} 0%, transparent 28%, transparent 72%, ${tintColor} 100%)`,
          opacity: 1,
        }}
      />
    </div>
  );
}
