import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { ComponentProps } from 'react';
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

type WorkbenchTopBarTestProps = ComponentProps<typeof WorkbenchTopBar>;

function renderWorkbenchTopBar(
  overrides: Partial<WorkbenchTopBarTestProps> = {},
) {
  const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
  const layoutProfile = resolveLayoutProfile(BUILT_IN_LAYOUT_MANIFEST, 'overlay-classic');
  const defaultProps: WorkbenchTopBarTestProps = {
    appearance,
    renderRuntime,
    layoutProfile,
    layoutSourcePath: null,
    availableLayoutProfiles: BUILT_IN_LAYOUT_MANIFEST.profiles,
    panels: [],
    openPanelIds: [],
    pinnedPanelIds: [],
    activePanelId: null,
    onPanelSelect: vi.fn(),
    onPanelToggle: vi.fn(),
    onPanelClose: vi.fn(),
    onPanelReorder: vi.fn(),
    onOpenSettings: vi.fn(),
    onToggleShellMode: vi.fn(),
    onSelectLayoutProfile: vi.fn(),
    onCycleLayout: vi.fn(),
    onSetWindowMode: vi.fn(),
    onOpenCommandPalette: vi.fn(),
    onToggleOverlayAnchor: vi.fn(),
    onClose: vi.fn(),
    accent: appearance.theme.palette.accent,
    blur: false,
    blurStrength: 0,
    blurPlatform: 'linux',
    appOpacity: 1,
    panelTransparency: 0,
    appZoom: 1,
    onUpdateAppearanceVisuals: vi.fn(),
    windowMode: 'overlay',
    overlayAnchor: 'top',
    commandPaletteShortcutLabel: 'Ctrl+K',
    mobileShareShortcutLabel: 'Ctrl+Alt+Shift+M',
    toggleShortcutLabel: 'Ctrl+Space',
    mobileShareRemoteAccessMode: 'lan',
    mobileSharePhase: 'idle',
    mobileShareSession: null,
    mobileShareError: null,
    mobileShareNotice: null,
    onToggleMobileShare: vi.fn(),
    onStartMobileShare: vi.fn(),
    onStopMobileShare: vi.fn(),
    onSetMobileShareRemoteAccessMode: vi.fn(),
    onOpenMobileSettings: vi.fn(),
    zenFocusMode: false,
    zenFocusShortcutLabel: 'Ctrl+.',
    onToggleZenFocusMode: vi.fn(),
    topBarDefinition,
    topBarCustomizeActive: false,
    onToggleTopBarCustomize: vi.fn(),
    onCommitTopBarLayoutSnapshot: vi.fn(),
  };

  return render(<WorkbenchTopBar {...defaultProps} {...overrides} />);
}

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
        availableLayoutProfiles={BUILT_IN_LAYOUT_MANIFEST.profiles}
        panels={panels}
        openPanelIds={['explorer', 'notes']}
        pinnedPanelIds={[]}
        activePanelId="notes"
        onPanelSelect={vi.fn()}
        onPanelToggle={vi.fn()}
        onPanelClose={vi.fn()}
        onPanelReorder={vi.fn()}
        onOpenSettings={vi.fn()}
        onToggleShellMode={vi.fn()}
        onSelectLayoutProfile={vi.fn()}
        onCycleLayout={vi.fn()}
        onSetWindowMode={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        onToggleOverlayAnchor={vi.fn()}
        onClose={vi.fn()}
        accent={appearance.theme.palette.accent}
        blur={false}
        blurStrength={0}
        blurPlatform="linux"
        appOpacity={1}
        panelTransparency={0}
        appZoom={1}
        onUpdateAppearanceVisuals={vi.fn()}
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
        topBarCustomizeActive={false}
        onToggleTopBarCustomize={vi.fn()}
        onCommitTopBarLayoutSnapshot={vi.fn()}
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
        availableLayoutProfiles={BUILT_IN_LAYOUT_MANIFEST.profiles}
        panels={[]}
        openPanelIds={[]}
        pinnedPanelIds={[]}
        activePanelId={null}
        onPanelSelect={vi.fn()}
        onPanelToggle={vi.fn()}
        onPanelClose={vi.fn()}
        onPanelReorder={vi.fn()}
        onOpenSettings={vi.fn()}
        onToggleShellMode={vi.fn()}
        onSelectLayoutProfile={vi.fn()}
        onCycleLayout={vi.fn()}
        onSetWindowMode={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        onToggleOverlayAnchor={vi.fn()}
        onClose={vi.fn()}
        accent={appearance.theme.palette.accent}
        blur={false}
        blurStrength={0}
        blurPlatform="linux"
        appOpacity={1}
        panelTransparency={0}
        appZoom={1}
        onUpdateAppearanceVisuals={vi.fn()}
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
        topBarCustomizeActive={false}
        onToggleTopBarCustomize={vi.fn()}
        onCommitTopBarLayoutSnapshot={vi.fn()}
      />,
    );

    const mobileShareButton = screen.getByTitle('Stop Mobile Share (Ctrl+Alt+Shift+M)');
    expect(mobileShareButton).toHaveAttribute('data-interaction-motion-surface', 'topBarButton');
    const idleMobileShareButtonBoxShadow = mobileShareButton.style.boxShadow;
    fireEvent.pointerEnter(mobileShareButton);
    expect(mobileShareButton.style.boxShadow).not.toBe(idleMobileShareButtonBoxShadow);
    fireEvent.click(mobileShareButton);
    expect(onToggleMobileShare).toHaveBeenCalledTimes(1);

    const mobileShareMenuAnchor = mobileShareButton.parentElement as HTMLElement;
    vi.spyOn(mobileShareMenuAnchor, 'getBoundingClientRect').mockReturnValue({
      x: 20,
      y: 18,
      left: 20,
      top: 18,
      right: 56,
      bottom: 40,
      width: 36,
      height: 22,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerEnter(mobileShareMenuAnchor);

    expect(await screen.findByText('Selected Route', {}, { timeout: 4000 })).toBeInTheDocument();
    const routeMenu = container.querySelector('[data-overlay-mobile-share-route-menu]') as HTMLElement | null;
    expect(routeMenu).not.toBeNull();
    await waitFor(() => {
      expect(routeMenu).toHaveStyle({ position: 'fixed' });
      expect(routeMenu?.style.left).toBe('20px');
      expect(routeMenu?.style.top).toBe('48px');
    });
    expect(container.firstElementChild).toHaveStyle({ overflow: 'visible' });
    const showQrCodesButton = screen.getByRole('button', { name: /show qr codes/i });
    expect(showQrCodesButton).toHaveAttribute('data-interaction-motion-surface', 'actionButton');
    const idleShowQrCodesButtonBoxShadow = showQrCodesButton.style.boxShadow;
    fireEvent.pointerEnter(showQrCodesButton);
    expect(showQrCodesButton.style.boxShadow).not.toBe(idleShowQrCodesButtonBoxShadow);
    fireEvent.click(screen.getByRole('button', { name: /tailscale/i }));
    expect(onSetMobileShareRemoteAccessMode).toHaveBeenCalledWith('tailscale');

    fireEvent.click(showQrCodesButton);

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
    expect(screen.getByRole('button', { name: /mobile settings/i }))
      .toHaveAttribute('data-interaction-motion-surface', 'actionButton');
    expect(onStartMobileShare).toHaveBeenCalledTimes(0);
  });

  it('opens surface controls from the top bar and writes zoom/transparency values', () => {
    const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
    const layoutProfile = resolveLayoutProfile(BUILT_IN_LAYOUT_MANIFEST, 'overlay-classic');
    const onUpdateAppearanceVisuals = vi.fn();

    render(
      <WorkbenchTopBar
        appearance={appearance}
        renderRuntime={renderRuntime}
        layoutProfile={layoutProfile}
        layoutSourcePath={null}
        availableLayoutProfiles={BUILT_IN_LAYOUT_MANIFEST.profiles}
        panels={[]}
        openPanelIds={[]}
        pinnedPanelIds={[]}
        activePanelId={null}
        onPanelSelect={vi.fn()}
        onPanelToggle={vi.fn()}
        onPanelClose={vi.fn()}
        onPanelReorder={vi.fn()}
        onOpenSettings={vi.fn()}
        onToggleShellMode={vi.fn()}
        onSelectLayoutProfile={vi.fn()}
        onCycleLayout={vi.fn()}
        onSetWindowMode={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        onToggleOverlayAnchor={vi.fn()}
        onClose={vi.fn()}
        accent={appearance.theme.palette.accent}
        blur={false}
        blurStrength={0}
        blurPlatform="linux"
        appOpacity={1}
        panelTransparency={0}
        appZoom={1}
        onUpdateAppearanceVisuals={onUpdateAppearanceVisuals}
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
        topBarDefinition={{
          ...topBarDefinition,
          leadingControls: ['surface-controls'],
          navigationShortcuts: [],
          trailingControls: [],
        }}
        topBarCustomizeActive={false}
        onToggleTopBarCustomize={vi.fn()}
        onCommitTopBarLayoutSnapshot={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /surface controls/i }));
    expect(screen.getByText('Surface Controls')).toBeInTheDocument();
    expect(screen.queryByLabelText(/blur strength/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/window zoom/i), { target: { value: '1.2' } });
    fireEvent.change(screen.getByLabelText(/panel transparency/i), { target: { value: '0.34' } });

    expect(onUpdateAppearanceVisuals).toHaveBeenCalledWith({ appZoom: 1.2 });
    expect(onUpdateAppearanceVisuals).toHaveBeenCalledWith({ panelTransparency: 0.34 });
  });

  it('spawns, focuses, and closes panels from the top-bar surface controls menu', () => {
    const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
    const layoutProfile = resolveLayoutProfile(BUILT_IN_LAYOUT_MANIFEST, 'overlay-classic');
    const onPanelSelect = vi.fn();
    const onPanelToggle = vi.fn();
    const onPanelClose = vi.fn();
    const panels = [
      {
        id: 'explorer',
        label: 'Explorer',
        description: 'Explorer panel',
        kind: 'built-in-panel' as const,
        icon: <span>E</span>,
        defaultOpen: true,
        render: () => null,
        navigation: { groupId: 'core', groupLabel: 'Core', groupOrder: 10, itemOrder: 10 },
      },
      {
        id: 'notes',
        label: 'Notes',
        description: 'Notes panel',
        kind: 'built-in-panel' as const,
        icon: <span>N</span>,
        defaultOpen: false,
        render: () => null,
        navigation: { groupId: 'core', groupLabel: 'Core', groupOrder: 10, itemOrder: 20 },
      },
      {
        id: 'plugin.gallery',
        label: 'Plugin Gallery',
        description: 'Folder plugin gallery panel',
        kind: 'folder-plugin' as const,
        icon: <span>P</span>,
        defaultOpen: false,
        render: () => null,
        navigation: { groupId: 'plugins', groupLabel: 'Plugin Panels', groupOrder: 30, itemOrder: 10 },
      },
    ];

    render(
      <WorkbenchTopBar
        appearance={appearance}
        renderRuntime={renderRuntime}
        layoutProfile={layoutProfile}
        layoutSourcePath={null}
        availableLayoutProfiles={BUILT_IN_LAYOUT_MANIFEST.profiles}
        panels={panels}
        openPanelIds={['explorer', 'notes']}
        pinnedPanelIds={[]}
        activePanelId="notes"
        onPanelSelect={onPanelSelect}
        onPanelToggle={onPanelToggle}
        onPanelClose={onPanelClose}
        onPanelReorder={vi.fn()}
        onOpenSettings={vi.fn()}
        onToggleShellMode={vi.fn()}
        onSelectLayoutProfile={vi.fn()}
        onCycleLayout={vi.fn()}
        onSetWindowMode={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        onToggleOverlayAnchor={vi.fn()}
        onClose={vi.fn()}
        accent={appearance.theme.palette.accent}
        blur={false}
        blurStrength={0}
        blurPlatform="linux"
        appOpacity={1}
        panelTransparency={0}
        appZoom={1}
        onUpdateAppearanceVisuals={vi.fn()}
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
        topBarDefinition={{
          ...topBarDefinition,
          leadingControls: ['surface-controls'],
          navigationShortcuts: [],
          trailingControls: [],
        }}
        topBarCustomizeActive={false}
        onToggleTopBarCustomize={vi.fn()}
        onCommitTopBarLayoutSnapshot={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /surface controls/i }));

    expect(screen.getByText('Spawn Panels')).toBeInTheDocument();
    expect(screen.getByText('Plugin Panels')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open plugin gallery panel/i }));
    expect(onPanelToggle).toHaveBeenCalledWith('plugin.gallery');

    fireEvent.click(screen.getByRole('button', { name: /focus notes panel/i }));
    expect(onPanelSelect).toHaveBeenCalledWith('notes');

    fireEvent.click(screen.getByRole('button', { name: /close notes panel/i }));
    expect(onPanelClose).toHaveBeenCalledWith('notes');
  });

  it('reorders draggable top-bar tabs through the shared panel reorder callback', () => {
    const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
    const layoutProfile = resolveLayoutProfile(BUILT_IN_LAYOUT_MANIFEST, 'overlay-classic');
    const onPanelReorder = vi.fn();
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
        id: 'terminal',
        label: 'Terminal',
        description: 'Terminal panel',
        kind: 'built-in-panel' as const,
        icon: <span>T</span>,
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
    const transferValues = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: vi.fn((type: string, value: string) => transferValues.set(type, value)),
      getData: vi.fn((type: string) => transferValues.get(type) ?? ''),
    };

    render(
      <WorkbenchTopBar
        appearance={appearance}
        renderRuntime={renderRuntime}
        layoutProfile={layoutProfile}
        layoutSourcePath={null}
        availableLayoutProfiles={BUILT_IN_LAYOUT_MANIFEST.profiles}
        panels={panels}
        openPanelIds={['explorer', 'terminal', 'notes']}
        pinnedPanelIds={[]}
        activePanelId="notes"
        onPanelSelect={vi.fn()}
        onPanelToggle={vi.fn()}
        onPanelClose={vi.fn()}
        onPanelReorder={onPanelReorder}
        onOpenSettings={vi.fn()}
        onToggleShellMode={vi.fn()}
        onSelectLayoutProfile={vi.fn()}
        onCycleLayout={vi.fn()}
        onSetWindowMode={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        onToggleOverlayAnchor={vi.fn()}
        onClose={vi.fn()}
        accent={appearance.theme.palette.accent}
        blur={false}
        blurStrength={0}
        blurPlatform="linux"
        appOpacity={1}
        panelTransparency={0}
        appZoom={1}
        onUpdateAppearanceVisuals={vi.fn()}
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
        topBarCustomizeActive={false}
        onToggleTopBarCustomize={vi.fn()}
        onCommitTopBarLayoutSnapshot={vi.fn()}
      />,
    );

    const notesTab = screen.getByRole('button', { name: /notes/i });
    const terminalTab = screen.getByRole('button', { name: /terminal/i });

    fireEvent.dragStart(notesTab, { dataTransfer });
    fireEvent.dragOver(terminalTab, { dataTransfer });
    fireEvent.drop(terminalTab, { dataTransfer });

    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'notes');
    expect(onPanelReorder).toHaveBeenCalledWith('notes', 'terminal');
  });

  it('can render chrome content without forcing window controls into theme-owned layouts', () => {
    renderWorkbenchTopBar({
      blurPlatform: 'windows',
      windowMode: 'windowed',
      surfaceMode: 'content-only',
    });

    expect(screen.getByTitle(/open command palette/i)).toBeInTheDocument();
    expect(screen.queryByTitle('Minimize')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Maximize')).not.toBeInTheDocument();
  });

  it('can render standalone window controls for theme-owned chrome placement', () => {
    renderWorkbenchTopBar({
      blurPlatform: 'windows',
      windowMode: 'windowed',
      surfaceMode: 'window-controls-only',
    });

    expect(screen.getByTitle('Minimize')).toBeInTheDocument();
    expect(screen.getByTitle('Maximize')).toBeInTheDocument();
    expect(screen.queryByTitle(/open command palette/i)).not.toBeInTheDocument();
  });

  it('treats empty windowed chrome as a native drag region without stealing control clicks', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const currentWindow = getCurrentWindow() as unknown as {
      startDragging: ReturnType<typeof vi.fn>;
      isMaximized: ReturnType<typeof vi.fn>;
      maximize: ReturnType<typeof vi.fn>;
      unmaximize: ReturnType<typeof vi.fn>;
    };
    currentWindow.startDragging.mockClear();
    currentWindow.isMaximized.mockResolvedValue(false);
    currentWindow.maximize.mockClear();
    currentWindow.unmaximize.mockClear();

    renderWorkbenchTopBar({
      blurPlatform: 'windows',
      windowMode: 'windowed',
      topBarDefinition: {
        ...topBarDefinition,
        leadingControls: [],
        navigationShortcuts: [],
        trailingControls: [],
      },
    });

    const topBar = screen.getByTitle('Drag Window');
    const maximizeButton = screen.getByTitle('Maximize');
    fireEvent.mouseDown(topBar, { button: 0, detail: 1 });
    expect(currentWindow.startDragging).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(topBar, { button: 0, detail: 2 });
    expect(currentWindow.startDragging).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(screen.getByTitle('Minimize'), { button: 0 });
    expect(currentWindow.startDragging).toHaveBeenCalledTimes(1);

    fireEvent.doubleClick(topBar);
    await waitFor(() => expect(currentWindow.maximize).toHaveBeenCalledTimes(1));

    fireEvent.doubleClick(maximizeButton);
    expect(currentWindow.maximize).toHaveBeenCalledTimes(1);
  });

  it('uses the top bar as the floating dock drag surface', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const currentWindow = getCurrentWindow() as unknown as {
      startDragging: ReturnType<typeof vi.fn>;
    };
    currentWindow.startDragging.mockClear();

    renderWorkbenchTopBar({
      blurPlatform: 'windows',
      windowMode: 'overlay',
      dockPlacementMode: 'floating',
      topBarDefinition: {
        ...topBarDefinition,
        leadingControls: [],
        navigationShortcuts: [],
        trailingControls: [],
      },
    });

    const topBar = screen.getByTitle('Drag Floating Dock');
    expect(topBar).toHaveStyle({ cursor: 'grab' });
    fireEvent.mouseDown(topBar, { button: 0, detail: 1 });
    expect(currentWindow.startDragging).toHaveBeenCalledTimes(1);
  });
});
