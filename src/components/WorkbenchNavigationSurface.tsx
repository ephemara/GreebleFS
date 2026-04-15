import { useMemo } from 'react';

import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  groupPanelsForWorkbenchNavigation,
  type ResolvedWorkbenchRenderRuntime,
} from '../config/workbenchRenderRuntime';
import { OverlayScrollArea } from './OverlayScrollArea';
import type { OverlayPanelDefinition } from '../panels/panelRegistry';

interface WorkbenchNavigationSurfaceProps {
  appearance: ResolvedOverlayAppearance;
  runtime: ResolvedWorkbenchRenderRuntime;
  panels: OverlayPanelDefinition[];
  pinnedPanelIds: string[];
  activePanelId: string | null;
  openPanelIds: string[];
  onActivatePanel: (panelId: string) => void;
}

export function WorkbenchNavigationSurface({
  appearance,
  runtime,
  panels,
  pinnedPanelIds,
  activePanelId,
  openPanelIds,
  onActivatePanel,
}: WorkbenchNavigationSurfaceProps) {
  const accent = appearance.theme.palette.accent;
  const text = appearance.theme.palette.textPrimary;
  const muted = appearance.theme.palette.textMuted;
  const border = 'var(--overlay-workbench-chrome-border)';
  const navigablePanels = useMemo(
    () => panels.filter(panel => !pinnedPanelIds.includes(panel.id)),
    [panels, pinnedPanelIds],
  );
  const groupedPanels = useMemo(
    () => groupPanelsForWorkbenchNavigation(navigablePanels),
    [navigablePanels],
  );

  if (runtime.launcherPlacement === 'hidden' || groupedPanels.length === 0) {
    return null;
  }

  const activeGroupId = groupedPanels.find(group => group.panels.some(panel => panel.id === activePanelId))?.id
    ?? groupedPanels[0]?.id
    ?? null;
  const activeGroup = groupedPanels.find(group => group.id === activeGroupId) ?? groupedPanels[0] ?? null;
  const railWidth = runtime.navigationRailWidth;

  const renderButton = (
    panel: OverlayPanelDefinition,
    options?: {
      large?: boolean;
    },
  ) => {
    const large = options?.large ?? false;
    const isActive = panel.id === activePanelId;
    const isOpen = openPanelIds.includes(panel.id);

    return (
      <button
        key={panel.id}
        onClick={() => onActivatePanel(panel.id)}
        title={panel.description}
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: large ? 'column' : 'row',
          alignItems: large ? 'flex-start' : 'center',
          justifyContent: 'flex-start',
          gap: large ? 10 : 8,
          padding: large ? '12px 12px 14px' : '10px 12px',
          borderRadius: large ? 18 : 12,
          border: `1px solid ${isActive ? 'var(--overlay-workbench-chrome-button-active-border)' : border}`,
          background: isActive
            ? 'var(--overlay-workbench-chrome-button-active-bg)'
            : 'var(--overlay-workbench-chrome-button-bg)',
          color: text,
          cursor: 'pointer',
          textAlign: 'left',
          boxShadow: isActive ? `0 0 0 1px ${accent}22 inset` : 'none',
          transition: 'background 0.16s, border-color 0.16s, box-shadow 0.16s, transform 0.16s',
          minHeight: large ? 96 : 0,
        }}
      >
        <span style={{
          width: large ? 36 : 18,
          height: large ? 36 : 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isActive ? accent : text,
          borderRadius: large ? 12 : 8,
          background: large ? `${accent}12` : 'transparent',
          flexShrink: 0,
        }}
        >
          {panel.icon}
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: large ? 12 : 11, fontWeight: 700, color: isActive ? text : appearance.theme.palette.textSecondary }}>
              {panel.label}
            </span>
            {isOpen && (
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: accent,
                  flexShrink: 0,
                }}
              />
            )}
          </span>
          <span style={{
            fontSize: large ? 10 : 9,
            lineHeight: 1.4,
            color: muted,
            opacity: large ? 0.9 : 0.75,
          }}
          >
            {panel.description}
          </span>
        </span>
      </button>
    );
  };

  return (
    <aside
      style={{
        width: railWidth,
        minWidth: railWidth,
        maxWidth: railWidth,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 12,
        borderRight: `1px solid ${border}`,
        background: 'var(--overlay-workbench-settings-rail-bg)',
        boxShadow: runtime.kind === 'desktop-stack' ? 'var(--overlay-workbench-shell-shadow)' : 'none',
        overflow: 'hidden',
      }}
    >
      {runtime.navigationSurface === 'cross-axis' && activeGroup ? (
        <>
          <OverlayScrollArea
            direction="horizontal"
            style={{ flex: '0 0 auto' }}
            viewportStyle={{ paddingBottom: 2 }}
            contentStyle={{ display: 'flex', gap: 8, minWidth: 'max-content' }}
          >
            {groupedPanels.map(group => {
              const isActive = group.id === activeGroup.id;
              return (
                <button
                  key={group.id}
                  onClick={() => onActivatePanel(group.panels[0]?.id ?? '')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 10px',
                    borderRadius: 999,
                    border: `1px solid ${isActive ? 'var(--overlay-workbench-chrome-button-active-border)' : border}`,
                    background: isActive ? 'var(--overlay-workbench-chrome-button-active-bg)' : 'var(--overlay-workbench-chrome-button-bg)',
                    color: isActive ? text : muted,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: isActive ? `0 0 0 1px ${accent}18 inset` : 'none',
                  }}
                >
                  <span>{group.label}</span>
                  <span style={{ color: accent }}>{group.panels.length}</span>
                </button>
              );
            })}
          </OverlayScrollArea>

          <OverlayScrollArea
            style={{ flex: 1, minHeight: 0 }}
            contentStyle={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 4 }}
          >
            {activeGroup.panels.map(panel => renderButton(panel))}
          </OverlayScrollArea>
        </>
      ) : runtime.navigationSurface === 'launcher-grid' ? (
        <OverlayScrollArea
          style={{ flex: 1, minHeight: 0 }}
          contentStyle={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 4 }}
        >
          {groupedPanels.map(group => (
            <section key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: muted }}>
                {group.label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {group.panels.map(panel => renderButton(panel, { large: true }))}
              </div>
            </section>
          ))}
        </OverlayScrollArea>
      ) : (
        <OverlayScrollArea
          style={{ flex: 1, minHeight: 0 }}
          contentStyle={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 4 }}
        >
          {groupedPanels.map(group => (
            <section key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: muted }}>
                {group.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.panels.map(panel => renderButton(panel))}
              </div>
            </section>
          ))}
        </OverlayScrollArea>
      )}
    </aside>
  );
}
