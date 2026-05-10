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
  disableContentScroll = false,
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
  disableContentScroll?: boolean;
  railWidth: number;
  onRailWidthChange: (width: number) => void;
  accent: string;
  settingsStyle: OverlayWorkbenchChromeStyle;
  panelRadius: number;
  blurEnabled: boolean;
}) {
  const floatingShell = settingsStyle === 'floating' || settingsStyle === 'glass';
  const contentGrid = (
    <div
      className={`grid w-full min-w-0 gap-2 px-2 pt-2 ${disableContentScroll ? 'h-full min-h-0 pb-2' : 'pb-3'} ${inspector ? 'xl:grid-cols-[minmax(0,1fr)_304px]' : ''}`.trim()}
      data-settings-shell-content="true"
      data-settings-active-section={activeSectionKey}
      data-settings-active-archetype={activeArchetype}
      data-settings-content-density={preferredContentDensity}
    >
      <div className={disableContentScroll ? 'flex min-h-0 min-w-0 flex-col' : 'min-w-0'}>
        {children}
      </div>
      {inspector ? (
        <aside
          className={disableContentScroll ? 'flex min-h-0 min-w-0 flex-col' : 'min-w-0'}
        >
          {inspector}
        </aside>
      ) : null}
    </div>
  );

  return (
    <div
      data-settings-shell="true"
      style={{
        display: 'flex',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        background: 'var(--overlay-workbench-settings-bg)',
        gap: 'calc(var(--overlay-workbench-panel-gap) * 0.5)',
        padding: 'calc(var(--overlay-workbench-page-padding) * 0.5)',
      }}
    >
      <ResizablePane
        size={railWidth}
        minSize={168}
        maxSize={280}
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
        <OverlayScrollArea
          style={{ flex: 1, minHeight: 0 }}
          viewportStyle={{
            padding: 0,
            overflow: disableContentScroll ? 'hidden' : undefined,
          }}
          contentStyle={
            disableContentScroll
              ? {
                  flex: '1 1 auto',
                  minHeight: 0,
                  height: '100%',
                }
              : undefined
          }
        >
          {contentGrid}
        </OverlayScrollArea>
      </main>
    </div>
  );
}
