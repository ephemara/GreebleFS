import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WorkbenchTopBar } from '../components/WorkbenchTopBar';
import { resolveOverlayAppearance } from '../config/appearance';
import { BUILT_IN_LAYOUT_MANIFEST, resolveLayoutProfile } from '../config/layoutProfiles';
import type { LoadedOverlayTopBarDefinition } from '../config/topBars';
import type { ResolvedWorkbenchRenderRuntime } from '../config/workbenchRenderRuntime';
import type { MobileShareSession } from '../runtime/mobileShareRuntime';

const { qrCodeToDataUrlMock } = vi.hoisted(() => ({
  qrCodeToDataUrlMock: vi.fn(async (url: string) => `data:image/png;base64,${Buffer.from(url).toString('base64')}`),
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: qrCodeToDataUrlMock,
  },
}));

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
        blurStrength={0}
        blurPlatform="linux"
        windowMode="overlay"
        overlayAnchor="top"
        commandPaletteShortcutLabel="Ctrl+K"
        mobileShareShortcutLabel="Ctrl+Alt+Shift+M"
        toggleShortcutLabel="Ctrl+Space"
        mobileShareRemoteAccessMode="lan"
        mobileSharePhase="idle"
        mobileShareSession={null}
        mobileShareError={null}
        mobileShareNotice={null}
        onToggleMobileShare={vi.fn()}
        onStartMobileShare={vi.fn()}
        onStopMobileShare={vi.fn()}
        onSetMobileShareRemoteAccessMode={vi.fn()}
        onOpenMobileSettings={vi.fn()}
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

  it('replaces the blur control with a mobile route menu and centered QR dialog', async () => {
    const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
    const layoutProfile = resolveLayoutProfile(BUILT_IN_LAYOUT_MANIFEST, 'overlay-classic');
    const onToggleMobileShare = vi.fn();
    const onStartMobileShare = vi.fn(async () => undefined);
    const onStopMobileShare = vi.fn(async () => undefined);
    const onSetMobileShareRemoteAccessMode = vi.fn();
    const onOpenMobileSettings = vi.fn();
    const session: MobileShareSession = {
      sharePath: '/tmp/greeble-mobile',
      remoteAccessMode: 'lan',
      startedAt: Date.now(),
      preferredUrl: 'https://my.rig:8080',
      result: {
        address: 'http://192.168.1.4:8080',
        preferred_address: 'https://my.rig:8080',
        mdns_address: 'my.rig:8080',
        ios_address: 'https://my.rig:8080',
        tailscale_address: 'https://greeble-node.tailnet.ts.net:8080',
        tailscale_https_ready: true,
      },
      connectionTargets: [
        {
          id: 'lan-secure',
          label: 'LAN HTTPS',
          description: 'Local-network HTTPS route for Safari and nearby devices.',
          kind: 'lan',
          url: 'https://my.rig:8080',
          isPreferred: true,
        },
        {
          id: 'tailnet',
          label: 'Tailnet',
          description: 'Remote path over the active tailnet when Tailscale is connected.',
          kind: 'tailscale',
          url: 'https://greeble-node.tailnet.ts.net:8080',
          isPreferred: false,
        },
        {
          id: 'lan-direct',
          label: 'LAN Direct',
          description: 'Direct local IP fallback for the current network.',
          kind: 'lan',
          url: 'http://192.168.1.4:8080',
          isPreferred: false,
        },
      ],
    };

    const { container } = render(
      <WorkbenchTopBar
        appearance={appearance}
        renderRuntime={renderRuntime}
        layoutProfile={layoutProfile}
        layoutSourcePath={null}
        panels={[]}
        openPanelIds={[]}
        pinnedPanelIds={[]}
        activePanelId={null}
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
        blurStrength={0}
        blurPlatform="linux"
        windowMode="overlay"
        overlayAnchor="top"
        commandPaletteShortcutLabel="Ctrl+K"
        mobileShareShortcutLabel="Ctrl+Alt+Shift+M"
        toggleShortcutLabel="Ctrl+Space"
        mobileShareRemoteAccessMode="lan"
        mobileSharePhase="running"
        mobileShareSession={session}
        mobileShareError={null}
        mobileShareNotice={null}
        onToggleMobileShare={onToggleMobileShare}
        onStartMobileShare={onStartMobileShare}
        onStopMobileShare={onStopMobileShare}
        onSetMobileShareRemoteAccessMode={onSetMobileShareRemoteAccessMode}
        onOpenMobileSettings={onOpenMobileSettings}
        zenFocusMode={false}
        zenFocusShortcutLabel="Ctrl+."
        onToggleZenFocusMode={vi.fn()}
        topBarDefinition={{
          ...topBarDefinition,
          trailingControls: ['mobile-share'],
        }}
      />,
    );

    const mobileShareButton = screen.getByTitle('Stop Mobile Share (Ctrl+Alt+Shift+M)');
    fireEvent.click(mobileShareButton);
    expect(onToggleMobileShare).toHaveBeenCalledTimes(1);

    fireEvent.pointerEnter(mobileShareButton.parentElement as HTMLElement);

    expect(await screen.findByText('Selected Route', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(container.firstElementChild).toHaveStyle({ overflow: 'visible' });
    fireEvent.click(screen.getByRole('button', { name: /tailscale/i }));
    expect(onSetMobileShareRemoteAccessMode).toHaveBeenCalledWith('tailscale');

    fireEvent.click(screen.getByRole('button', { name: /show qr codes/i }));

    const dialogTitle = await screen.findByText('Phone Pairing', {}, { timeout: 4000 });
    expect(dialogTitle).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(dialog.style.maxWidth).toBe('min(92vw, 980px)');
    expect(dialog.style.maxHeight).toBe('calc(100vh - 40px)');
    expect(screen.getByRole('list', { name: /mobile share connection targets/i }).style.gridTemplateColumns)
      .toBe('repeat(auto-fit, minmax(min(100%, 216px), 1fr))');
    expect(await screen.findByAltText('QR code for LAN HTTPS', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(await screen.findByAltText('QR code for Tailnet', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(await screen.findByAltText('QR code for LAN Direct', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(qrCodeToDataUrlMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: /mobile settings/i })).toBeInTheDocument();
    expect(onStartMobileShare).toHaveBeenCalledTimes(0);
  });
});
