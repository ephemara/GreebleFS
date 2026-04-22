import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WorkbenchTopBar } from '../components/WorkbenchTopBar';
import { resolveOverlayAppearance } from '../config/appearance';
import { BUILT_IN_LAYOUT_MANIFEST, resolveLayoutProfile } from '../config/layoutProfiles';
import type { LoadedOverlayTopBarDefinition } from '../config/topBars';
import type { ResolvedWorkbenchRenderRuntime } from '../config/workbenchRenderRuntime';

const topBarDefinition: LoadedOverlayTopBarDefinition = {
  id: 'test-top-bar',
  localId: 'test-top-bar',
  name: 'Test Top Bar',
  description: 'Test top bar',
  source: 'built-in',
  sourceLabel: 'Built-in',
  navigationMode: 'auto',
  leadingControls: ['command-palette'],
  navigationShortcuts: ['settings-shortcut', 'explorer-shortcut'],
  trailingControls: ['close-overlay'],
  tags: [],
};

const renderRuntime: ResolvedWorkbenchRenderRuntime = {
  kind: 'desktop-stack',
  label: 'Desktop Stack',
  description: 'Desktop stack runtime',
  renderStyleId: null,
  renderStyleKind: null,
  layoutPrimitiveId: null,
  navigationPatternId: null,
  shellBlueprint: 'classic-dock',
  navigationSurface: 'tabs',
  contentLayout: 'tabbed',
  launcherPlacement: 'sidebar',
  navigationRailWidth: 240,
  showTabStrip: true,
  showExplorerShortcut: true,
  showSettingsShortcut: true,
  preferLargeLauncherTargets: false,
  useGroupedNavigation: false,
};

describe('WorkbenchTopBar', () => {
  it('routes top-bar buttons and panel tabs through shared interaction motion bindings', () => {
    const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
    const layoutProfile = resolveLayoutProfile(BUILT_IN_LAYOUT_MANIFEST, 'overlay-classic');
    const panels = [
      {
        id: 'explorer',
        label: 'Explorer',
        description: 'Explorer panel',
        kind: 'built-in-panel' as const,
        icon: <span>E</span>,
        defaultOpen: true,
        render: () => null,
      },
      {
        id: 'settings',
        label: 'Settings',
        description: 'Settings panel',
        kind: 'built-in-panel' as const,
        icon: <span>S</span>,
        defaultOpen: false,
        render: () => null,
      },
      {
        id: 'notes',
        label: 'Notes',
        description: 'Notes panel',
        kind: 'built-in-panel' as const,
        icon: <span>N</span>,
        defaultOpen: false,
        render: () => null,
      },
    ];

    render(
      <WorkbenchTopBar
        appearance={appearance}
        renderRuntime={renderRuntime}
        layoutProfile={layoutProfile}
        layoutSourcePath={null}
        panels={panels}
        openPanelIds={['explorer', 'notes']}
        pinnedPanelIds={[]}
        activePanelId="notes"
        onPanelSelect={vi.fn()}
        onPanelToggle={vi.fn()}
        onPanelClose={vi.fn()}
        onPanelReorder={vi.fn()}
        onOpenSettings={vi.fn()}
        onCycleLayout={vi.fn()}
        onSetWindowMode={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        onToggleOverlayAnchor={vi.fn()}
        onClose={vi.fn()}
        accent={appearance.theme.palette.accent}
        blur={false}
        onBlurChange={vi.fn()}
        blurStrength={0}
        blurPlatform="linux"
        windowMode="overlay"
        overlayAnchor="top"
        commandPaletteShortcutLabel="Ctrl+K"
        toggleShortcutLabel="Ctrl+Space"
        zenFocusMode={false}
        zenFocusShortcutLabel="Ctrl+."
        onToggleZenFocusMode={vi.fn()}
        topBarDefinition={topBarDefinition}
      />,
    );

    const commandButton = screen.getByTitle(/open command palette/i);
    const settingsButton = screen.getByTitle(/open settings/i);
    const explorerButton = screen.getByTitle(/open explorer/i);
    const notesTab = screen.getByRole('button', { name: /notes/i });

    expect(commandButton).toHaveAttribute('data-interaction-motion-surface', 'topBarButton');
    expect(settingsButton).toHaveAttribute('data-interaction-motion-surface', 'panelTab');
    expect(explorerButton).toHaveAttribute('data-interaction-motion-surface', 'panelTab');
    expect(notesTab).toHaveAttribute('data-interaction-motion-surface', 'panelTab');

    fireEvent.pointerEnter(commandButton);
    expect(commandButton.style.transform).toContain('translate3d');

    fireEvent.pointerEnter(notesTab);
    expect(notesTab.style.transform).toContain('translate3d');
  });
});
