import type { ReactNode } from 'react';
import { OverlayScrollArea } from '../OverlayScrollArea';
import { ResizablePane } from '../ResizablePane';
import type { OverlayWorkbenchChromeStyle } from '../../config/workbenchTheme';

export function SettingsShell({
  rail,
  header,
  children,
  inspector,
  activeSectionKey,
  activeArchetype,
  preferredContentDensity,
  railWidth,
  onRailWidthChange,
  accent,
  settingsStyle,
  panelRadius,
  blurEnabled,
}: {
  rail: ReactNode;
  header: ReactNode;
  children: ReactNode;
  inspector?: ReactNode;
  activeSectionKey?: string;
  activeArchetype?: string;
  preferredContentDensity?: string;
  railWidth: number;
  onRailWidthChange: (width: number) => void;
  accent: string;
  settingsStyle: OverlayWorkbenchChromeStyle;
  panelRadius: number;
  blurEnabled: boolean;
}) {
  const floatingShell = settingsStyle === 'floating' || settingsStyle === 'glass';

  return (
    <div
      data-settings-shell="true"
      style={{
        display: 'flex',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        background: 'var(--overlay-workbench-settings-bg)',
        gap: 'var(--overlay-workbench-panel-gap)',
        padding: 'var(--overlay-workbench-page-padding)',
      }}
    >
      <ResizablePane
        size={railWidth}
        minSize={190}
        maxSize={320}
        onSizeChange={onRailWidthChange}
        borderColor={`${accent}55`}
        style={{
          display: 'flex',
          minHeight: 0,
          flexDirection: 'column',
          border: '1px solid var(--overlay-workbench-settings-card-border)',
          borderRadius: panelRadius,
          background: 'var(--overlay-workbench-settings-rail-bg)',
          boxShadow: floatingShell ? 'var(--overlay-workbench-shell-shadow)' : 'none',
          backdropFilter: blurEnabled && settingsStyle === 'glass' ? 'blur(18px)' : 'none',
          WebkitBackdropFilter: blurEnabled && settingsStyle === 'glass' ? 'blur(18px)' : 'none',
          overflow: 'hidden',
        }}
      >
        {rail}
      </ResizablePane>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col" data-settings-shell-main="true">
        {header}
        <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: 0 }}>
          <div
            className={`grid w-full min-w-0 gap-3 px-4 pt-3 pb-5 ${inspector ? 'xl:grid-cols-[minmax(0,1fr)_320px]' : ''}`.trim()}
            data-settings-shell-content="true"
            data-settings-active-section={activeSectionKey}
            data-settings-active-archetype={activeArchetype}
            data-settings-content-density={preferredContentDensity}
          >
            <div className="min-w-0">{children}</div>
            {inspector ? <aside className="min-w-0">{inspector}</aside> : null}
          </div>
        </OverlayScrollArea>
      </main>
    </div>
  );
}
